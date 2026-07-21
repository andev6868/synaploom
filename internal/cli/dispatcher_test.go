package cli

import "testing"

func TestDispatcherParsesStartCommand(t *testing.T) {
	command, err := Parse([]string{"start", "frontend-performance-foundations", "--port", "0"})
	if err != nil {
		t.Fatal(err)
	}
	if command.Name != "start" || command.CourseID != "frontend-performance-foundations" || command.Port != 0 {
		t.Fatalf("unexpected command: %#v", command)
	}
}

func TestDispatcherParsesDevCommandWithPort(t *testing.T) {
	command, err := Parse([]string{"dev", "examples/course", "--port", "4174"})
	if err != nil {
		t.Fatal(err)
	}
	if command.Name != "dev" || command.Path != "examples/course" || command.Port != 4174 {
		t.Fatalf("unexpected command: %#v", command)
	}
}

func TestDispatcherParsesDevCommandWithEphemeralPortByDefault(t *testing.T) {
	command, err := Parse([]string{"dev", "examples/course"})
	if err != nil {
		t.Fatal(err)
	}
	if command.Port != 0 {
		t.Fatalf("port=%d, want 0", command.Port)
	}
}

func TestDispatcherParsesCourseCommands(t *testing.T) {
	for _, args := range [][]string{{"course", "validate", "./course"}, {"course", "import", "./course"}, {"course", "list"}} {
		if _, err := Parse(args); err != nil {
			t.Fatalf("Parse(%v): %v", args, err)
		}
	}
}

func TestDispatcherRejectsUnknownCommand(t *testing.T) {
	if _, err := Parse([]string{"unknown"}); err == nil {
		t.Fatal("expected usage error")
	}
}
