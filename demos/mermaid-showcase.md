# Mermaid demo: a tiny project snapshot

Fictional but plausible data to show off three Mermaid diagram types in one note. This feature exists because users asked for it, and it is awesome to finally have Mermaid in a lightweight notes app (still a rare combo).

## Quick context

A small team keeps notes in Markdown Manager and tracks progress every month.

## Project focus (pie)

```mermaid
pie title Q2 time allocation
  "Writing & editing" : 38
  "Research" : 24
  "Client calls" : 18
  "Admin" : 12
  "Breaks" : 8
```

## Simple workflow (diagram)

```mermaid
flowchart LR
  Idea --> Draft --> Review --> Publish
  Review -->|Needs changes| Draft
```

## Monthly activity (bar + line)

```mermaid
xychart-beta
  title "Notes created vs published"
  x-axis ["Jan","Feb","Mar","Apr","May","Jun"]
  y-axis "Notes" 0 --> 120
  bar "Created" [42, 58, 63, 77, 88, 95]
  line "Published" [30, 40, 52, 60, 72, 85]
```

Find more demos and examples here on mermaid https://mermaid.live/