# Netflix category catalogue review

**Reviewed:** 2026-10-27
**Purpose:** Record what the current sources actually publish and what has been compiled into Wachoo so far.

## Current scope

- `apps/api/prisma/data/netflix-tudum-2025.json` contains **44 unique Netflix category codes** explicitly named in Netflix Tudum's May 12, 2025 guide. It is the first official-source batch, not a complete catalogue.
- `apps/api/prisma/data/netflix-catalogue-2026.json` contains the current merged catalogue: **1,870 unique codes**, imported into local PostgreSQL on 2026-10-27. It preserves the original source evidence, parent paths, and official-first verification ordering.
- The What's on Netflix ID Bible page advertises “well over 2,200” codes, but its downloadable CSV and rendered category groups contained **1,835 rows and 1,835 unique codes** when inspected on 2026-10-27. This is a source-internal count mismatch; Wachoo imports the rows actually present in the download, not the advertised 2,200+ figure.
- The current Netflix-Codes.com page had **291 code appearances across 26 groups**, which deduplicated to **223 unique codes**. **23** were additional to the 1,847-code catalogue assembled from the What's on Netflix CSV and the previous local records; those 23 brought the merged local total to **1,870**.
- The current local PostgreSQL database contains **1,870 distinct Netflix category codes**. The initial catalogue had 47; the What's on Netflix download added 1,800 codes after deduplication, and Netflix-Codes.com added 23 more. 44 records retain the agreed official Netflix mention evidence.
- Netflix Tudum says Netflix's internal code list exceeded **36,000** in May 2025. This is Netflix's stated internal catalogue size; the article provides selected examples rather than a downloadable complete list.
- The downloadable Netflix-Codes.com list has repeated appearances; repeated codes are represented once in Wachoo with multiple source-backed parent links where the page supplies them.

## Review findings

- Repeated code appearances should become one category record with all observed parent links. For example, `5507` (“Animal tales”) appears under both Anime and Children & Family Movies; that repetition alone does not show the code is invalid.
- The third-party page contains spelling and naming variants, including “Science & navature documentaries” and “Romantical dramas.” Preserve the source's exact wording in evidence, then choose a careful display name only when another source supports it. Do not silently correct the source transcript.
- A code listed by a third party is not thereby confirmed to work in every region. Availability and names can change.
- The data file records the Netflix article URL and the date the article was checked for every official-mentioned item. `live_checked` follows Wachoo's agreed rule that an official Netflix mention qualifies for verified-first ordering; it does not mean all 44 Netflix category pages were opened and tested in the same region.
- Wachoo's reported team approval permits the project to reuse the third-party lists with credit on the Terms & Conditions page. This is not a license or endorsement from Netflix or Netflix-Codes.com. Add and review that attribution before publishing the catalogue.
- The project used source-provided public lists for a one-time catalogue compilation. It does not scrape either site at runtime. Do not create a recurring collector or automate direct Netflix checks until applicable access rules are confirmed. Netflix's own Terms of Use restrict automated collection from Netflix without express authorization.

## Data handling decisions

1. Keep the source URL, evidence type, observation date, and source label with each category.
2. Store one row per Netflix code; merge repeated source parent paths into that row.
3. Sort official Netflix-mentioned or directly observed records before records supported only by third-party listings. The public catalogue does not need a separate “unverified” badge.
4. Keep mood labels and search keywords as Wachoo editorial metadata, separate from what the sources claim.
5. Maintain a static Wachoo dataset. Do not depend on either source website at runtime.

## Sources checked

- [Netflix Tudum: Netflix Secret Codes in 2025](https://www.netflix.com/tudum/articles/netflix-secret-codes-guide) — published 2025-05-12; checked 2026-10-27.
- [What's on Netflix: Netflix ID Bible](https://www.whats-on-netflix.com/what-to-watch/the-netflix-id-bible-every-category-on-netflix/) — page and embedded downloadable CSV checked 2026-10-27.
- [Netflix-Codes.com directory](https://www.netflix-codes.com/) — checked 2026-10-27.
- [Netflix-Codes.com privacy policy](https://www.netflix-codes.com/privacy) — checked 2026-10-27.
- [Netflix Terms of Use](https://help.netflix.com/legal/termsofuse) — checked 2026-10-27.
- [Netflix-Codes.com `robots.txt`](https://www.netflix-codes.com/robots.txt) — linked for follow-up; contents could not be retrieved during this review.
