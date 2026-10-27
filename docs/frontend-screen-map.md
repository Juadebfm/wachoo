# Wachoo frontend screen map

This is a planning document for the responsive web MVP. It uses the agreed Wachoo design direction and the current product brief. It does not describe UI that has already been implemented unless marked as existing.

## Main discovery flow

```text
Homepage hero -> Mood discovery / Search -> Results -> Category details
                         |                         -> Copy, open, save, or report
                         +-> Surprise Me           -> Saved categories
```

## Screens and states

| Screen | Main purpose and actions | State and data needs |
| --- | --- | --- |
| **Homepage hero** | Introduce Wachoo as a Netflix category guide, explain discovery by mood, genre, or code, and link down to the mood section. Keep it on the same page so the main action is one scroll away. | Responsive, brand-led hero and in-page anchor; no separate route or additional service required. |
| **Discover** | Introduce Wachoo with the prompt “Wetin you wan watch today?” and supporting copy “Choose a mood. Discover something different.” Show six large mood shortcuts: Make I Laugh, Something Scary, Crime & Mystery, Love Stories, Action, and Surprise Me. Keep direct search available for category names, keywords, and codes; browse results below. Header includes the supplied logo. | Mood shortcuts are keyboard-operable buttons with text labels; emoji are decorative. The approved filter tags are `comedy`, `scary`, `crime`, `romance`, and `action`. Selecting a mood filters the results. “Surprise Me” selects a random category from the full current catalogue. Search text, selected mood, result count; loading, empty, and error states. The current seed only has categories tagged `scary`; other mood filters will be empty until matching records are added. |
| **Results / directory** | Use a prominent search field, result count, and a “Favourites only” filter before a vertical list. Each row shows the category name, a short parent or mood descriptor, code, save control, “Copy code,” and “Open Netflix.” Selecting the category opens its details. Officially mentioned or directly checked codes sort first, followed by other collected codes. Do not display an “unverified” label. | Search and mood filters; favourites-only filtering and saved count; pagination or progressive loading for the large catalogue; clear no-results and request-error states. Keep provenance and verification data in the application data for maintenance. |
| **Category details** | Show the category name, available description, code, parent groups, moods, copy/open actions, related categories, favourite action, and report action. | Category record and its source evidence. Whether the detail page should show a last-checked date or source note is still open; no unverified badge is planned. |
| **Saved categories** | Let users return to categories they saved without an account. | Browser local storage, empty state, and remove-from-saved action. |
| **Report an issue** | Let a user report a category that fails, seems outdated, has incorrect details, or is unavailable in their region. | Validated form, submission progress, confirmation, and recoverable error. Submission needs a backend endpoint and basic abuse prevention. |
| **Terms & Conditions** | Credit Netflix-Codes.com and What's on Netflix for catalogue sources, as confirmed by the user. | Source names and links; final attribution wording is to be reviewed before release. |
| **Admin area** | Let authorized administrators maintain categories and review reports, as required in the brief. | Server-enforced authentication and authorization. Sign-in method and admin access rules are not yet specified. |

## Shared behavior

- Dark theme is the default; a light theme uses the approved Soft White and dark-green roles. Theme preference persistence is undecided.
- Use the JustWatch reference for discoverable search and filtering structure only. Keep Wachoo's colors, logo, wording, and category-code focus.
- Use the supplied screenshot for list hierarchy and actions, not its grayscale styling. Keep category rows compact on wide screens and stack actions on narrow screens.
- Use the mood-card screenshot for the six starter shortcuts and conversational Nigerian-English prompt; style the grid with Wachoo's shared dark/light surface and accent tokens.
- Support keyboard use, visible focus, readable contrast, semantic controls, and reduced-motion preferences.
- Give clear feedback for copying, saving, reporting, and opening external Netflix pages. Do not imply a category will work in every region.
- On smaller screens, keep search, mood selection, result names, and primary actions easy to reach without horizontal scrolling.

## Existing versus planned

- **Existing:** One React screen with category search, mood filtering, result cards, copy-code/link actions, Netflix links, and loading, empty, and error feedback. It uses the dark palette and collapses to one column on narrow screens.
- **Updated in this change:** Added the mood shortcut grid, favourites-only filtering, browser-saved categories, surprise pick, and compact category rows. Removed visible verification labels and sorted records with official provider evidence first.
- **UX reference accepted:** The user approved the supplied screenshot's search, favourites-only filter, category-row, save, copy-code, and open-Netflix pattern, with Wachoo's design system retained.
- **Mood discovery accepted:** The user approved the six mood shortcuts, the prompt “Wetin you wan watch today?”, and their filter tags: comedy, scary, crime, romance, and action.
- **Planned:** Light theme and switch, category details, issue reports, Terms & Conditions, a larger paginated catalogue, and the protected admin area.

## Design review when implemented

- Confirm search by name, keyword, code, and mood reaches the right category results.
- Confirm evidence ordering is applied without a visible unverified label.
- Check copy success/failure, external-link behavior, loading/empty/error states, and keyboard focus.
- Check light and dark themes and readable layouts at narrow and wide viewport sizes.
- Verify reporting and admin actions against the backend API and authorization rules; frontend controls alone are not security.

The supplied brand PDF was not text-extractable with the available local tools, so this map relies on the product brief, the existing interface, and the agreed design-system note.

## Frontend handoff and next steps

At each completed frontend milestone, report what is done, what was checked, any open decision, and one recommended next step.

1. **Design planning — complete:** The design direction, screen map, mood shortcuts, and filter tags are recorded.
2. **Homepage and Discover — current milestone:** The welcome hero, in-page jump to mood discovery, mood grid, search/results hierarchy, saved categories, favourites-only filter, and surprise pick are implemented. **Next:** review the running app at desktop and mobile widths, then add more category records for the approved mood tags.
3. **Core discovery UI complete:** Align report and admin screens with the backend API contract and server-side access rules before connecting them. **Next:** integrate those backend-dependent flows, then do a final frontend review.

The repository currently provides web `build` and `typecheck` scripts; it does not define a web test script. Do not describe an interaction, browser review, or check as complete until it has actually been performed.
