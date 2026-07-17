package runner

import (
	"errors"
	"testing"
	"time"
)

func TestResolverRejectsUnknownAction(t *testing.T) {
	resolver := NewResolver(map[string]Action{"run": {Program: "node", Args: []string{"main.js"}}})
	_, err := resolver.Resolve("shell")
	if !errors.Is(err, ErrActionNotFound) {
		t.Fatalf("expected ErrActionNotFound, got %v", err)
	}
}

func TestResolverReturnsStructuredDefensiveCopy(t *testing.T) {
	action := Action{Program: "node", Args: []string{"main.js"}, WorkingDir: ".", Environment: []string{"NODE_ENV=test"}, Timeout: time.Second, MaxOutputByte: 1024}
	resolver := NewResolver(map[string]Action{"run": action})
	request, err := resolver.Resolve("run")
	if err != nil {
		t.Fatal(err)
	}
	request.Args[0] = "changed"
	request.Environment[0] = "changed"
	again, err := resolver.Resolve("run")
	if err != nil {
		t.Fatal(err)
	}
	if again.Args[0] != "main.js" || again.Environment[0] != "NODE_ENV=test" {
		t.Fatal("resolver leaked mutable action slices")
	}
	if request.ExecutionID == "" || again.ExecutionID == request.ExecutionID {
		t.Fatal("each resolution must receive a unique execution ID")
	}
}

func TestResolverRejectsUnsafeDefinitions(t *testing.T) {
	tests := []Action{
		{Program: ""},
		{Program: "node", WorkingDir: "/tmp"},
		{Program: "node", WorkingDir: `C:\\temp`},
		{Program: "node", WorkingDir: "../outside"},
		{Program: "node", Timeout: -time.Second},
		{Program: "node", MaxOutputByte: -1},
	}
	for _, action := range tests {
		resolver := NewResolver(map[string]Action{"run": action})
		if _, err := resolver.Resolve("run"); !errors.Is(err, ErrInvalidAction) {
			t.Fatalf("expected ErrInvalidAction for %#v, got %v", action, err)
		}
	}
}
