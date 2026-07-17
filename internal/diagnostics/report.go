package diagnostics

import (
	"github.com/synaploom/synaploom/internal/buildinfo"
	"os"
	"runtime"
	"strings"
)

type Input struct {
	Home                                                           string
	DatabasePath                                                   string
	BackupPaths, InstalledCourses, MissingRuntimes, RecentFailures []string
	MigrationStatus                                                string
}
type Report struct {
	Version          string   `json:"version"`
	Commit           string   `json:"commit"`
	SchemaVersion    string   `json:"schemaVersion"`
	GoVersion        string   `json:"goVersion"`
	OS               string   `json:"os"`
	Arch             string   `json:"arch"`
	Home             string   `json:"home"`
	DatabasePath     string   `json:"databasePath"`
	MigrationStatus  string   `json:"migrationStatus"`
	BackupPaths      []string `json:"backupPaths"`
	InstalledCourses []string `json:"installedCourses"`
	MissingRuntimes  []string `json:"missingRuntimes"`
	RecentFailures   []string `json:"recentFailures"`
	LoopbackOnly     bool     `json:"loopbackOnly"`
}

func BuildReport(i Input) Report {
	return Report{Version: buildinfo.Version, Commit: buildinfo.Commit, SchemaVersion: buildinfo.SchemaVersion, GoVersion: runtime.Version(), OS: runtime.GOOS, Arch: runtime.GOARCH, Home: i.Home, DatabasePath: i.DatabasePath, MigrationStatus: i.MigrationStatus, BackupPaths: clone(i.BackupPaths), InstalledCourses: clone(i.InstalledCourses), MissingRuntimes: clone(i.MissingRuntimes), RecentFailures: redact(i.RecentFailures), LoopbackOnly: true}
}
func DefaultHome() string {
	if v := os.Getenv("SYNAPLOOM_HOME"); v != "" {
		return v
	}
	h, _ := os.UserHomeDir()
	return h + string(os.PathSeparator) + ".synaploom"
}
func clone(v []string) []string {
	if v == nil {
		return []string{}
	}
	return append([]string(nil), v...)
}
func redact(v []string) []string {
	o := make([]string, 0, len(v))
	for _, x := range v {
		l := strings.ToLower(x)
		if strings.Contains(l, "token") || strings.Contains(l, "api-key") || strings.Contains(l, "prompt") {
			o = append(o, "[redacted]")
		} else {
			o = append(o, x)
		}
	}
	return o
}
