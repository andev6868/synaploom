package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/synaploom/synaploom/internal/buildinfo"
	"github.com/synaploom/synaploom/internal/cli"
	"github.com/synaploom/synaploom/internal/course"
	"github.com/synaploom/synaploom/internal/diagnostics"
	"github.com/synaploom/synaploom/internal/progression"
	"github.com/synaploom/synaploom/internal/runner"
	"github.com/synaploom/synaploom/internal/server"
	"github.com/synaploom/synaploom/internal/storage"
)

func Run(ctx context.Context, command cli.Command) int {
	switch command.Name {
	case "version":
		fmt.Fprintf(os.Stdout, "synaploom version=%s commit=%s schema=%s\n", buildinfo.Version, buildinfo.Commit, buildinfo.SchemaVersion)
		return cli.ExitSuccess
	case "doctor":
		home := diagnostics.DefaultHome()
		r := diagnostics.BuildReport(diagnostics.Input{Home: home, DatabasePath: home + "/state/synaploom.db", MigrationStatus: "unknown"})
		if command.JSON {
			_ = json.NewEncoder(os.Stdout).Encode(r)
		} else {
			fmt.Fprintf(os.Stdout, "Synaploom %s (%s)\nHome: %s\nDatabase: %s\n", r.Version, r.Commit, r.Home, r.DatabasePath)
		}
		return cli.ExitSuccess
	case "course validate":
		if _, err := course.OpenFilesystemService(command.Path); err != nil {
			fmt.Fprintln(os.Stderr, err)
			return cli.ExitOperational
		}
		fmt.Fprintln(os.Stdout, "course valid")
		return cli.ExitSuccess
	case "course import":
		installed, err := course.Import(ctx, command.Path, filepath.Join(diagnostics.DefaultHome(), "courses"))
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return cli.ExitOperational
		}
		fmt.Fprintf(os.Stdout, "imported %s@%s\n", installed.Manifest.Id, installed.Manifest.Version)
		return cli.ExitSuccess
	case "course list":
		entries, _ := os.ReadDir(filepath.Join(diagnostics.DefaultHome(), "courses"))
		for _, e := range entries {
			if e.IsDir() {
				fmt.Fprintln(os.Stdout, e.Name())
			}
		}
		return cli.ExitSuccess
	case "start":
		root := filepath.Join(diagnostics.DefaultHome(), "courses", command.CourseID)
		versions, err := os.ReadDir(root)
		if err != nil || len(versions) == 0 {
			fmt.Fprintln(os.Stderr, "course not installed")
			return cli.ExitOperational
		}
		selected := ""
		for _, e := range versions {
			if e.IsDir() && e.Name() > selected {
				selected = e.Name()
			}
		}
		svc, err := course.OpenFilesystemService(filepath.Join(root, selected))
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return cli.ExitOperational
		}
		return serve(ctx, svc, command.Port)
	case "dev":
		svc, err := course.OpenFilesystemService(command.Path)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return cli.ExitOperational
		}
		return serve(ctx, svc, command.Port)
	default:
		return cli.ExitUsage
	}
}
func serve(ctx context.Context, service course.Service, port int) int {
	runtime, err := OpenRuntime(ctx, diagnostics.DefaultHome())
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return cli.ExitOperational
	}
	defer runtime.Close()
	sessions := server.NewSessionManager()
	token, err := sessions.IssueBootstrapToken()
	if err != nil {
		return cli.ExitOperational
	}
	handler, err := configureRouter(ctx, service, sessions, runtime.Database)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return cli.ExitOperational
	}
	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return cli.ExitOperational
	}
	srv := &http.Server{Handler: handler}
	fmt.Fprintf(os.Stdout, "http://%s/bootstrap?token=%s\n", listener.Addr(), token)
	go func() { <-ctx.Done(); _ = srv.Shutdown(context.Background()) }()
	if err := srv.Serve(listener); err != nil && err != http.ErrServerClosed {
		return cli.ExitOperational
	}
	return cli.ExitSuccess
}

type progressionGraphSource interface {
	ProgressionGraph() (progression.CourseGraph, error)
}

func configureRouter(ctx context.Context, service course.Service, sessions *server.SessionManager, database *storage.Database) (http.Handler, error) {
	source, ok := service.(progressionGraphSource)
	if !ok {
		return server.NewRouter(service, sessions), nil
	}
	graph, err := source.ProgressionGraph()
	if err != nil {
		return nil, fmt.Errorf("configure progression graph: %w", err)
	}
	progress := progression.NewService(database.SQL, storage.NewHierarchicalProgressRepository(), graph)
	if _, err := progress.Initialize(ctx); err != nil {
		return nil, fmt.Errorf("initialize progression: %w", err)
	}
	content := service
	if filesystem, ok := service.(*course.FilesystemService); ok {
		content = &progressionAwareFilesystemService{FilesystemService: filesystem, progression: progress, graph: graph}
	}
	return server.NewRouter(content, sessions, server.WithProgression(progress)), nil
}

type progressionAwareFilesystemService struct {
	*course.FilesystemService
	progression *progression.ServiceImpl
	graph       progression.CourseGraph
}

func (s *progressionAwareFilesystemService) RecordActionResult(ctx context.Context, lessonID, actionID string, result runner.Result) error {
	if err := s.FilesystemService.RecordActionResult(ctx, lessonID, actionID, result); err != nil {
		return err
	}
	if actionID != "check" {
		return nil
	}
	lesson, ok := s.graph.LessonIndex[lessonID]
	if !ok || len(lesson.Practices) == 0 {
		return nil
	}
	passed := result.ExitCode != nil && *result.ExitCode == 0 && result.Err == nil
	_, err := s.progression.RecordLessonPracticeResult(ctx, lessonID, lesson.Practices[0].ID, progression.AttemptResult{
		Passed: passed, CompletedAt: time.Now().UTC(), Summary: resultSummary(result),
	})
	return err
}

func resultSummary(result runner.Result) string {
	if result.Err != nil {
		return result.Err.Error()
	}
	if result.ExitCode != nil {
		return fmt.Sprintf("exit code %d", *result.ExitCode)
	}
	return "completed"
}
