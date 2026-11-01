package workflow

import (
	"bytes"
	"errors"
	"image"
	_ "image/jpeg" // register decoders used by image.DecodeConfig / image.Decode
	_ "image/png"
	"net/http"
	"strconv"

	_ "golang.org/x/image/webp"
)

// Verification is manual: these pictures are stored only so an administrator
// can look at them. Nothing here reads, scores or approves their content.

type DocumentRequirement struct {
	Type     string `json:"type"`
	Label    string `json:"label"`
	Required bool   `json:"required"`
}

// documentRequirements lists the picture types each verifiable role may upload.
// Only tutors and coaching centres go through verification.
var documentRequirements = map[string][]DocumentRequirement{
	"tutor": {
		{Type: "identity", Label: "National ID, passport or birth certificate", Required: true},
		{Type: "education", Label: "Latest academic certificate or student ID", Required: false},
	},
	"coaching": {
		{Type: "trade_license", Label: "Trade licence or registration certificate", Required: true},
		{Type: "owner_identity", Label: "Owner or director national ID", Required: true},
	},
}

func RequirementsFor(role string) []DocumentRequirement { return documentRequirements[role] }

func verifiableRole(role string) bool { _, ok := documentRequirements[role]; return ok }

func allowedDocumentType(role, documentType string) bool {
	for _, r := range documentRequirements[role] {
		if r.Type == documentType {
			return true
		}
	}
	return false
}

// missingRequired returns the labels of required document types not in uploaded.
func missingRequired(role string, uploaded map[string]bool) []string {
	var missing []string
	for _, r := range documentRequirements[role] {
		if r.Required && !uploaded[r.Type] {
			missing = append(missing, r.Label)
		}
	}
	return missing
}

// maxDocumentBytes caps every uploaded file; SetMaxUploadBytes changes it at
// start-up (serverless hosts limit request bodies).
var maxDocumentBytes = 10 << 20

// SetMaxUploadBytes sets the per-file upload limit. Call it before serving.
func SetMaxUploadBytes(n int) {
	if n > 0 {
		maxDocumentBytes = n
	}
}

// MaxUploadBytes returns the per-file upload limit.
func MaxUploadBytes() int { return maxDocumentBytes }

// MaxUploadLabel describes the limit for error messages, such as "10 MB".
func MaxUploadLabel() string { return strconv.Itoa(maxDocumentBytes>>20) + " MB" }

const (
	// A small file can declare enormous dimensions and expand to gigabytes when
	// decoded (a decompression bomb), so dimensions are checked before decoding.
	maxDocumentPixels = 40_000_000
)

var ErrInvalidImage = errors.New("document is not a valid JPEG, PNG or WebP image")

// ValidateImage is validateImage for other packages (profile photos, attachments).
func ValidateImage(content []byte) (string, error) { return validateImage(content) }

// validateImage checks the actual bytes rather than the filename or the
// client-supplied Content-Type: the sniffed type must be an accepted image, the
// header must parse with sane dimensions, and the whole image must decode.
// It returns the MIME type to store.
func validateImage(content []byte) (string, error) {
	if len(content) == 0 || len(content) > maxDocumentBytes {
		return "", ErrInvalidImage
	}
	mime := http.DetectContentType(content)
	if !isSupportedImage(mime) {
		return "", ErrInvalidImage
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(content))
	if err != nil || "image/"+format != mime || cfg.Width <= 0 || cfg.Height <= 0 || cfg.Width*cfg.Height > maxDocumentPixels {
		return "", ErrInvalidImage
	}
	if _, _, err := image.Decode(bytes.NewReader(content)); err != nil {
		return "", ErrInvalidImage
	}
	return mime, nil
}

func isSupportedImage(mimeType string) bool {
	return mimeType == "image/jpeg" || mimeType == "image/png" || mimeType == "image/webp"
}
