package diagnostics

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestDoctorNeverReportsSecrets(t *testing.T) {
	b, _ := json.Marshal(BuildReport(Input{RecentFailures: []string{"bootstrap-token api-key prompt-content"}}))
	for _, s := range []string{"bootstrap-token", "api-key", "prompt-content"} {
		if strings.Contains(string(b), s) {
			t.Fatalf("leaked %s", s)
		}
	}
}
