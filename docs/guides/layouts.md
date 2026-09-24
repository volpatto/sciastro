# Navigation layouts and motion

Layout settings are independent of the site's profile and theme. They work with
`kind: individual`, `kind: group` and `kind: course`, and with the Classic,
Modern and LNCC themes. Existing sites retain their layout when these fields are
omitted.

## Main navigation

In `sciastro.yaml`:

```yaml
layout:
  navigation: top
  subnavigation: right
```

| Field                  | Values                    | Behavior                                                                                                            |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `layout.navigation`    | `top`, `sidebar`          | Places the site's main menu across the top or in a sidebar on sufficiently wide screens                             |
| `layout.subnavigation` | `inline`, `right`, `none` | Keeps the article contents in the reading flow, uses a contextual right panel, or hides the supplemental navigation |

If `navigation` is omitted, LNCC uses its sidebar and the other themes use top
navigation. `subnavigation` defaults to `inline`. Responsive layouts remain
usable on small screens; a sidebar or right panel is not forced into a narrow
desktop-style column on a phone.

For an optional translucent top menu, combine `layout.navigation: top` with
`appearance.navigation: glass`. It floats near the top while scrolling and keeps
the native collapsible menu on mobile. Omission or `solid` preserves the ordinary
treatment; sidebar navigation ignores this option. See the
[appearance guide](appearance.md#use-a-translucent-top-menu) for a recipe and solid
fallbacks for browser support and accessibility preferences.

### Menu readability and interaction

Menus use a consistent 14px text scale, 18px icons and at least 44px-high
controls. Short, left-aligned labels make sections easier to scan; the current
page and its parent section have a visible accent marker. Use a concise page
`title` for its navigation label and a longer `heading` when the page needs one.
The course example uses **Início** in the menu and **Métodos Numéricos** on the page.

When a section is itself a page, its label remains a link and the adjacent
chevron only opens its children. They share one continuous background and equal
height, including wrapped labels, while retaining separate keyboard focus and
click targets. This combines the [W3C link-and-disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation-hybrid/)
with the clear hierarchy and state treatment of [Carbon's side navigation](https://carbondesignsystem.com/components/UI-shell-left-panel/style/).
Browsers supporting CSS subgrid and `::details-content` size the control to the
label automatically; older engines retain a functional fixed-size disclosure.

Submenus open with their disclosure control, by pointer or keyboard. `Tab`
reaches links and controls; `Enter` or `Space` toggles a disclosure; `Escape`
closes an open submenu and returns focus to its control. Desktop dropdowns
also close when focus or a pointer action moves outside the navigation. Links
and native disclosures remain usable without JavaScript.

These choices follow [USWDS header guidance](https://designsystem.digital.gov/components/header/),
[Carbon's compact navigation scale](https://carbondesignsystem.com/components/UI-shell-header/style/)
and the [W3C disclosure navigation pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation-hybrid/).
The 44px target follows the [W3C enhanced target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html);
it is a design choice, not a claim of full accessibility conformance. Site
navigation uses labelled `nav` landmarks and lists, rather than ARIA `menu` roles.

The theme action uses a moon to **switch to dark mode** and a sun to **switch to
light mode**, with a matching tooltip and accessible name in the page's language.
Its 44px circular target centers the icon independently of text line height.
The saved preference is preserved across pages; without an explicit choice the
site follows the system color scheme. Without JavaScript, the inactive control
is hidden and the system color scheme still applies.

## Contextual navigation

With `subnavigation: right`, the panel can contain:

- A link to the parent page.
- The current page's children.
- Other pages under the same parent.
- Links to the current page's second- and third-level headings.

Links use the page hierarchy declared with `parent`, and stay in the current
language. They do not require separate menu entries. Hidden navigation branches
are omitted. Set `toc: false` on a page to exclude its headings from the contents
list while retaining its hierarchical links.

`navigationDepth` still controls the depth visible in the **main** menu. It does
not delete deeper pages; listings, contextual navigation and ordinary links keep
them reachable. See [hierarchical pages](writing.md#start-a-section-for-posts)
for the authoring fields.

```yaml
navigation: [home, lessons]
navigationDepth: 1
layout:
  navigation: sidebar
  subnavigation: right
```

This combination keeps the main menu short while lesson pages provide their
local navigation. The [course tutorial](../tutorials/course.md) is a complete
example.

## Cards and interaction feedback

Article listings place the title first, followed by the description and optional
date, authors and tags. On wider screens, titles and descriptions align within
each row using content-sized grid tracks. Text is not truncated and card heights
are not fixed. On phones, cards stack and use only the space their content needs.

Linked cards have a restrained shadow and a stronger border/shadow when their
link is hovered or focused. A listing card has one destination, so its whole area
opens that article using a native link and a single keyboard stop. Markdown cards
can contain several links: those links keep their own targets, and plain cards
without links do not receive interactive styling. Printed pages omit shadows.

This treatment draws on the consistency and interaction guidance in the
[Ontario Design System](https://designsystem.ontario.ca/components/detail/cards.html).
Visual feedback remains available with motion disabled; movement and animated
transitions follow the settings below.

## Optional motion

Decorative motion is disabled by default. Enable a small response on supported
interactive controls and linked cards:

```yaml
appearance:
  motion: subtle
```

Choose `none`, `subtle` or `expressive`. The expressive option increases the
movement slightly; it does not add scroll-triggered content reveals or make
reading depend on an animation. These effects respect the operating system's
reduced-motion preference and are disabled for touch/coarse-pointer interaction.

Content, contrast, keyboard focus and menu behavior remain usable with motion
disabled. Keep your existing color and caption settings under `appearance`
alongside `motion`; do not replace the entire mapping unnecessarily.

## Choose a starting point

The [gallery](../gallery.md) includes individual and group profiles, an LNCC
composition, scientific writing and a course. Its source links show the YAML
behind each preview. You can select a different layout without copying its
theme's components or writing JavaScript.
