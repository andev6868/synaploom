package cli

import (
	"errors"
	"flag"
	"fmt"
)

var ErrUsage = errors.New("invalid command usage")

type Command struct {
	Name     string
	CourseID string
	Path     string
	Port     int
	JSON     bool
}

func Parse(args []string) (Command, error) {
	if len(args) == 0 {
		return Command{}, fmt.Errorf("%w: missing command", ErrUsage)
	}
	switch args[0] {
	case "version":
		if len(args) != 1 {
			return Command{}, fmt.Errorf("%w: version takes no arguments", ErrUsage)
		}
		return Command{Name: "version"}, nil
	case "doctor":
		set := flag.NewFlagSet("doctor", flag.ContinueOnError)
		jsonOutput := set.Bool("json", false, "emit JSON")
		if err := set.Parse(args[1:]); err != nil || set.NArg() != 0 {
			return Command{}, fmt.Errorf("%w: invalid doctor arguments", ErrUsage)
		}
		return Command{Name: "doctor", JSON: *jsonOutput}, nil
	case "start":
		return parseCourseRuntime("start", args[1:])
	case "dev":
		return parseDev(args[1:])
	case "course":
		return parseCourse(args[1:])
	default:
		return Command{}, fmt.Errorf("%w: unknown command %q", ErrUsage, args[0])
	}
}

func parseCourseRuntime(name string, args []string) (Command, error) {
	if len(args) == 0 {
		return Command{}, fmt.Errorf("%w: missing course ID", ErrUsage)
	}
	courseID := args[0]
	set := flag.NewFlagSet(name, flag.ContinueOnError)
	port := set.Int("port", 0, "local HTTP port")
	if err := set.Parse(args[1:]); err != nil {
		return Command{}, fmt.Errorf("%w: %v", ErrUsage, err)
	}
	if set.NArg() != 0 {
		return Command{}, fmt.Errorf("%w: unexpected arguments", ErrUsage)
	}
	return Command{Name: name, CourseID: courseID, Port: *port}, nil
}

func parseDev(args []string) (Command, error) {
	if len(args) == 0 {
		return Command{}, fmt.Errorf("%w: dev requires a course path", ErrUsage)
	}
	path := args[0]
	set := flag.NewFlagSet("dev", flag.ContinueOnError)
	port := set.Int("port", 0, "local HTTP port")
	if err := set.Parse(args[1:]); err != nil || set.NArg() != 0 {
		return Command{}, fmt.Errorf("%w: dev requires a course path", ErrUsage)
	}
	return Command{Name: "dev", Path: path, Port: *port}, nil
}

func parseCourse(args []string) (Command, error) {
	if len(args) == 0 {
		return Command{}, fmt.Errorf("%w: missing course subcommand", ErrUsage)
	}
	switch args[0] {
	case "list":
		if len(args) != 1 {
			return Command{}, fmt.Errorf("%w: course list takes no path", ErrUsage)
		}
		return Command{Name: "course list"}, nil
	case "validate", "import":
		if len(args) != 2 {
			return Command{}, fmt.Errorf("%w: course %s requires a path", ErrUsage, args[0])
		}
		return Command{Name: "course " + args[0], Path: args[1]}, nil
	default:
		return Command{}, fmt.Errorf("%w: unknown course subcommand %q", ErrUsage, args[0])
	}
}
