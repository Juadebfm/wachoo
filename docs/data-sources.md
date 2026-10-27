# Netflix category data sources

## Collection policy

- Treat Netflix-Codes.com as a third-party reference, not a Netflix API or complete authority.
- Treat the What's on Netflix ID Bible and its CSV as third-party data, not a Netflix API or official complete catalogue.
- Use Netflix's own published material and direct category pages as primary evidence where available.
- Store source URLs and the date each item was observed. A source listing is not the same as a successful live check.
- Do not infer regional availability from a category page checked in an unspecified region.
- **Reuse permission reported by Wachoo:** The project owner says their team approved using the third-party lists and codes if Wachoo credits the sources on its Terms & Conditions page. This is an internal permission reported by the project owner; it is not an endorsement or license from Netflix, What's on Netflix, or Netflix-Codes.com. Add the agreed attribution before publishing the catalogue.
- Keep the catalogue as a static, independently managed Wachoo dataset. Do not make either source a runtime dependency.
- Netflix's Terms of Use prohibit robots, scrapers, and data gathering against the Netflix service unless expressly authorized. Do not automate checks of Netflix category pages. The Netflix-Codes.com page inspected on 2026-10-27 exposes a privacy policy and an all-rights-reserved footer; no separate terms page was found. Its current `robots.txt` could not be retrieved during this review, so permission for automated collection from that site remains unconfirmed. Do not build an automated collector until those access rules are checked.
- Keep mood mappings as Wachoo editorial metadata. Do not present them as Netflix classifications.

## Verification labels

- `third_party_listed`: a third-party source lists the code; no direct current Netflix page check is recorded.
- `live_checked`: Netflix evidence supports the code, either through an official Netflix publication that names it (the project-approved minimum for verified-first ordering) or a direct Netflix category page observed on the recorded date. A direct page observation is time- and region-limited; an official article is evidence only for what it names.
- `unverified`: evidence is insufficient to assign either label above.
- `live_check_failed` and `retired` are reserved for future records with recorded evidence; neither is used in the seed.

`lastVerifiedAt` records the date the primary Netflix evidence was checked. `verificationRegion` is set only when a direct category page was checked in a known region. Public UI does not need to display a separate unverified badge; the API returns verified records first.

## Reviewed seed records

| Code | Wachoo label | Evidence | Status as of 2026-10-27 |
| --- | --- | --- | --- |
| `8711` | Horror Movies | Netflix-Codes lists “Horror movies”; the Netflix page displayed “Essential Horror Flicks.” | `live_checked`; displayed heading differs from the third-party label. Region was not established. |
| `7424` | Anime | Listed by Netflix-Codes; Netflix's page displayed “Anime.” | `live_checked`; region was not established. |
| `81466194` | 90-Minute Movies | Named with this code in Netflix Tudum and displayed with the same title on its Netflix page. | `live_checked`; also officially mentioned by Netflix. Region was not established. |
| `5507` | Animal Tales | Netflix-Codes lists it beneath both Anime and Children & Family Movies. | `third_party_listed`; not directly checked. Preserve both parent paths; this is not evidence the code is invalid. |

The category-site list also contains a likely source-label typo (“Science & navature documentaries”). Preserve the original source wording in evidence; do not silently treat it as a verified Netflix title. A repeated code under multiple parent groups should be represented as one provider/code record with multiple source-backed parent links. Search keywords and moods are Wachoo editorial metadata; they must not be presented as source claims.

## Source links

- [Netflix-Codes category directory](https://www.netflix-codes.com/)
- [What's on Netflix: Netflix ID Bible](https://www.whats-on-netflix.com/what-to-watch/the-netflix-id-bible-every-category-on-netflix/)
- [Netflix-Codes privacy policy](https://www.netflix-codes.com/privacy)
- [Netflix-Codes robots.txt](https://www.netflix-codes.com/robots.txt) - linked for follow-up; its contents were not retrievable during the 2026-10-27 review.
- [Netflix Tudum: Netflix Secret Codes](https://www.netflix.com/tudum/articles/netflix-secret-codes-guide)
- [Netflix Terms of Use](https://help.netflix.com/legal/termsofuse)
