package ratelimit

import (
	"testing"
	"time"
)

func TestLimiterBlocksAfterLimitAndResetsAfterWindow(t *testing.T) {
	now := time.Unix(1_000_000, 0)
	l := New(3, time.Minute)
	l.now = func() time.Time { return now }

	for i := 0; i < 3; i++ {
		if ok, _ := l.Allow("k"); !ok {
			t.Fatalf("attempt %d should be allowed", i+1)
		}
		l.Hit("k")
	}
	ok, wait := l.Allow("k")
	if ok || wait != time.Minute {
		t.Fatalf("expected block with 1m wait, got ok=%v wait=%v", ok, wait)
	}
	if ok, _ := l.Allow("other"); !ok {
		t.Fatal("keys must be independent")
	}

	now = now.Add(time.Minute)
	if ok, _ := l.Allow("k"); !ok {
		t.Fatal("window should have reset")
	}
}

func TestLimiterResetClearsKey(t *testing.T) {
	l := New(1, time.Hour)
	l.Hit("k")
	if ok, _ := l.Allow("k"); ok {
		t.Fatal("expected block")
	}
	l.Reset("k")
	if ok, _ := l.Allow("k"); !ok {
		t.Fatal("expected allow after reset")
	}
}
