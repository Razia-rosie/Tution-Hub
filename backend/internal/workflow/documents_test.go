package workflow

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"hash/crc32"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"
)

func testImage() image.Image {
	img := image.NewRGBA(image.Rect(0, 0, 64, 48))
	for x := 0; x < 64; x++ {
		img.Set(x, x%48, color.RGBA{R: 200, A: 255})
	}
	return img
}

func encodePNG(t *testing.T) []byte {
	var b bytes.Buffer
	if err := png.Encode(&b, testImage()); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

func encodeJPEG(t *testing.T) []byte {
	var b bytes.Buffer
	if err := jpeg.Encode(&b, testImage(), nil); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

// A valid 1x1 lossy WebP; the standard library has no WebP encoder.
var webpFixture, _ = base64.StdEncoding.DecodeString("UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=")

func TestValidateImageAcceptsRealImages(t *testing.T) {
	for name, tc := range map[string]struct {
		data []byte
		mime string
	}{
		"png":  {encodePNG(t), "image/png"},
		"jpeg": {encodeJPEG(t), "image/jpeg"},
		"webp": {webpFixture, "image/webp"},
	} {
		mime, err := validateImage(tc.data)
		if err != nil || mime != tc.mime {
			t.Errorf("%s: got %q, %v", name, mime, err)
		}
	}
}

func TestValidateImageRejectsNonImagesAndForgeries(t *testing.T) {
	pngData := encodePNG(t)
	jpegData := encodeJPEG(t)
	// Correct PNG signature and header, but the pixel data is cut off.
	truncated := pngData[:len(pngData)/2]
	// A WebP container header with no decodable bitstream.
	fakeWebP := append([]byte("RIFF\x1a\x00\x00\x00WEBPVP8 "), make([]byte, 16)...)
	cases := map[string][]byte{
		"empty":              {},
		"text":               []byte("hello, not an image"),
		"svg":                []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`),
		"pdf":                []byte("%PDF-1.4\n%%EOF"),
		"gif":                []byte("GIF89a\x01\x00\x01\x00\x00\x00\x00;"),
		"truncated png":      truncated,
		"fake webp":          fakeWebP,
		"jpeg header + junk": append(append([]byte{}, jpegData[:20]...), bytes.Repeat([]byte{0}, 200)...),
		"oversized":          make([]byte, maxDocumentBytes+1),
	}
	for name, data := range cases {
		if _, err := validateImage(data); err != ErrInvalidImage {
			t.Errorf("%s: expected ErrInvalidImage, got %v", name, err)
		}
	}
}

func TestValidateImageRejectsDecompressionBomb(t *testing.T) {
	data := encodePNG(t)
	// Rewrite the IHDR chunk to claim 50000x50000 pixels and fix its CRC so the
	// header itself is well formed; only the declared size is hostile.
	ihdr := data[8:]
	binary.BigEndian.PutUint32(ihdr[8:12], 50000)
	binary.BigEndian.PutUint32(ihdr[12:16], 50000)
	binary.BigEndian.PutUint32(ihdr[21:25], crc32.ChecksumIEEE(ihdr[4:21]))
	if _, err := validateImage(data); err != ErrInvalidImage {
		t.Fatalf("expected ErrInvalidImage, got %v", err)
	}
}

func TestDocumentRequirements(t *testing.T) {
	if !verifiableRole("tutor") || !verifiableRole("coaching") || verifiableRole("student") || verifiableRole("parent") || verifiableRole("admin") {
		t.Fatal("only tutors and coaching centres are verified")
	}
	if !allowedDocumentType("coaching", "trade_license") || allowedDocumentType("tutor", "trade_license") || allowedDocumentType("tutor", "../etc") {
		t.Fatal("document types must be role specific")
	}
	if got := missingRequired("coaching", map[string]bool{"trade_license": true}); len(got) != 1 {
		t.Fatalf("coaching without owner ID should miss 1 document, got %v", got)
	}
	if got := missingRequired("tutor", map[string]bool{"identity": true}); len(got) != 0 {
		t.Fatalf("education picture is optional for tutors, got %v", got)
	}
	for _, s := range []string{"", "draft", "resubmission_required"} {
		if !editableApplication(s) {
			t.Errorf("%q should be editable", s)
		}
	}
	for _, s := range []string{"pending", "under_review", "approved", "rejected"} {
		if editableApplication(s) {
			t.Errorf("%q must be locked", s)
		}
	}
}
