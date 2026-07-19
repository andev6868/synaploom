package activity

func ResolvePresentation(definition ActivityDefinition) ActivityPresentation {
	if definition.Presentation != nil && definition.Presentation.DefaultSurface != "auto" {
		return *definition.Presentation
	}

	resolved := ActivityPresentation{
		DefaultSurface:     "inline",
		AllowInline:        true,
		AllowPractice:      true,
		PreferredWidth:     "compact",
		SupportsFullscreen: false,
	}
	switch definition.Kind {
	case ActivityKindWriting, ActivityKindCoding:
		resolved.DefaultSurface = "practice"
		resolved.PreferredWidth = "wide"
		resolved.SupportsFullscreen = true
	case ActivityKindSingleChoice, ActivityKindMultipleChoice:
		if collectionLength(definition.Config, "options") > 6 {
			resolved.DefaultSurface = "practice"
			resolved.PreferredWidth = "standard"
		}
	case ActivityKindOrdering:
		if collectionLength(definition.Config, "items") > 6 {
			resolved.DefaultSurface = "practice"
			resolved.PreferredWidth = "standard"
		}
	case ActivityKindMatching:
		if collectionLength(definition.Config, "left") > 5 || collectionLength(definition.Config, "right") > 5 {
			resolved.DefaultSurface = "practice"
			resolved.PreferredWidth = "standard"
		}
	}

	if definition.Presentation == nil {
		return resolved
	}
	authored := *definition.Presentation
	authored.DefaultSurface = resolved.DefaultSurface
	if authored.DefaultSurface == "practice" && !authored.AllowPractice {
		authored.DefaultSurface = "inline"
	}
	if authored.DefaultSurface == "inline" && !authored.AllowInline {
		authored.DefaultSurface = "practice"
	}
	return authored
}

func collectionLength(config map[string]any, key string) int {
	items, ok := config[key].([]any)
	if !ok {
		return 0
	}
	return len(items)
}
