# Brand Rename: VidyaMithra / Vidorya → LakshyaTrack

> [!IMPORTANT]
> All instances of the old brand names (**VidyaMithra**, **Vidorya**, **VidyaMitra**) have been replaced with **LakshyaTrack** across the entire codebase.

## ✅ Files Updated

### Frontend
| File | Changes |
|:-----|:--------|
| `frontend/index.html` | Page title + favicon SVG path |
| `frontend/package.json` | Package name |
| `frontend/package-lock.json` | Package name (2 locations) |
| `frontend/lint_results.txt` | Lint command reference |
| `frontend/src/components/PremiumNavbar.tsx` | Navbar brand logo |
| `frontend/src/components/AppSidebar.tsx` | Sidebar brand logo |
| `frontend/src/components/AuthLoadingScreen.tsx` | Loading screen brand |
| `frontend/src/context/ThemeContext.tsx` | Theme storage key |
| `frontend/src/pages/Landing.tsx` | Navbar logo, footer, copyright |
| `frontend/src/pages/Login.tsx` | Left panel logo, copyright, mobile logo, subtitle |
| `frontend/src/pages/Register.tsx` | Left panel logo, copyright, mobile logo |
| `frontend/src/pages/VerifyEmail.tsx` | Left panel logo, copyright, mobile logo |
| `frontend/src/pages/ResumeBuilder/templates/DeveloperTemplate.tsx` | Resume footer watermark |

### Backend
| File | Changes |
|:-----|:--------|
| `backend/app/main.py` | API docstring, startup/ready/shutdown logs |
| `backend/app/middleware/logging.py` | Logger namespace |
| `backend/app/services/opportunity_service.py` | User-Agent headers (2 locations) |
| `backend/app/services/code_execution_service.py` | Temp directory name |
| `backend/app/core/background_jobs.py` | Module docstring |
| `backend/app/core/resilience.py` | Module docstring |
| `backend/app/api/endpoints/admin.py` | Module docstring |

### Configuration & Docs
| File | Changes |
|:-----|:--------|
| `vercel.json` | Static file routing rules (SVG references) |
| `README.md` | Title, descriptions, project structure path |
| `INTEGRATION_GUIDE.md` | Title |
| `FINAL_DEPLOY_GUIDE.md` | Title, repository name reference |
| `verify_all_connections.py` | Infrastructure test banner |
| `test_api.py` | Hardcoded test URL |
| `test_api_users.py` | Hardcoded test URL |

## ⚠️ Post-Rename Action Items

> [!WARNING]
> The following items may need manual attention:

1. **Favicon SVG file**: If you have a `vidorya.svg` file in `frontend/public/`, rename it to `lakshyatrack.svg`
2. **Vercel domain**: The test URLs now point to `lakshyatrack.vercel.app` — make sure your Vercel project is configured with this domain
3. **`node_modules/.package-lock.json`**: Auto-generated, will refresh on next `npm install`

## 🔍 Verification

A full-codebase search confirmed **zero remaining references** to `vidorya`, `vidyamithra`, or `vidyamitra` in all source files (`.py`, `.ts`, `.tsx`, `.json`, `.md`, `.html`, `.txt`, `.css`). The only remaining match is in `node_modules/.package-lock.json`, which is auto-generated.
