package platform

import "testing"

func TestTakaText(t *testing.T) {
	for in, want := range map[float64]string{0: "৳0", 999: "৳999", 7000: "৳7,000", 1234567: "৳1,234,567", 7000.5: "৳7,000.5"} {
		if got := takaText(in); got != want {
			t.Errorf("takaText(%v) = %q, want %q", in, got, want)
		}
	}
}

func TestMonthLabelAndParse(t *testing.T) {
	if got := monthLabel("2026-11"); got != "November 2026" {
		t.Errorf("monthLabel = %q", got)
	}
	for _, bad := range []string{"2026-13", "2026-1", "26-11", "november", ""} {
		if _, err := parseMonth(bad); err == nil {
			t.Errorf("parseMonth(%q) accepted", bad)
		}
	}
	if _, err := parseMonth("2026-01"); err != nil {
		t.Errorf("parseMonth rejected a valid month: %v", err)
	}
}

func TestTuitionRefAndUniqueIDs(t *testing.T) {
	if got := tuitionRef("3f2a9c1e-0000-4000-8000-000000000000"); got != "TH-3F2A9C1E" {
		t.Errorf("tuitionRef = %q", got)
	}
	if got := uniqueIDs("a", "", "b", "a"); len(got) != 2 || got[0] != "a" || got[1] != "b" {
		t.Errorf("uniqueIDs = %v", got)
	}
}
