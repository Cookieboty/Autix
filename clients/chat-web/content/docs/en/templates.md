# Template System

Templates are one of the core capabilities of Amux Design. They allow creators to preserve proven prompt structures for efficient reuse.

## What is a Template

A template consists of the following components:

| Field | Description |
|-------|-------------|
| **Title** | Template name, e.g. "Cinematic Portrait" |
| **Category** | Classification: portrait, product, landscape, abstract, etc. |
| **Prompt** | Core prompt text, supports `{{variable}}` syntax |
| **Variable Definitions** | Variable names, types, defaults, and options |
| **Cover Image** | Template effect showcase image |

## Variable Syntax

Use `{{variable_name}}` in template prompts to mark replaceable parts:

```
A cinematic portrait of a {{gender}}, {{age_range}} years old,
with a {{expression}} expression. Shot in {{lighting}} lighting
with {{color_tone}} color grading.
```

Users only need to fill in variable values to generate the complete prompt.

## Template Status Flow

```
Created(PENDING) → Submit Review(IN_REVIEW) → Approved(APPROVED) / Rejected(REJECTED)
                                                 ↓
                                              Archived(ARCHIVED)
```

- **PENDING** — Draft state, visible only to the author
- **IN_REVIEW** — Submitted for review, awaiting admin approval
- **APPROVED** — Review passed, publicly displayed in the template market
- **REJECTED** — Review failed, can be modified and resubmitted
- **ARCHIVED** — Archived, removed from market but still accessible to the author

## Creating a Template

1. Go to **My Templates** page
2. Click **Create Template**
3. Fill in template info and prompt
4. Define variable parameters
5. Upload an effect cover image
6. Save and submit for review

## Using a Template

1. Browse or search templates in the **Template Market**
2. Click a template to view details
3. Fill in variable parameters
4. Select a generation model
5. Click generate

## Best Practices

- **Structure your prompts**: Organize by subject, scene, style, then technical parameters
- **Moderate variable granularity**: Too fine increases filling cost, too coarse loses flexibility
- **Provide defaults**: Set reasonable default values to lower the usage barrier
- **Include great examples**: Cover images showcasing best results attract more users
