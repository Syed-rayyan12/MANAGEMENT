# ProManage - User Credentials

**Default Password for All Users:** `password123`

---

## Project Managers (PM) - 3 Users

| Name | Username | Email | Role |
|------|----------|-------|------|
| Azhar Rajput | `azharrajput` | pm1@company.com | PM |
| Aqsa Rathore | `aqsarathore` | pm2@company.com | PM |
| Muhammad Huzafa | `muhammadhuzafa` | pm3@company.com | PM |

---

## Team Leads (TL) - 2 Users

| Name | Username | Email | Role |
|------|----------|-------|------|
| Mustufa | `mustufa` | tl1@company.com | TL |
| Ali | `ali` | tl2@company.com | TL |

---

## Executives (EXECUTIVE) - 4 Users

| Name | Username | Email | Role |
|------|----------|-------|------|
| Muhammad Marij | `muhammadmarij` | exec1@company.com | EXECUTIVE |
| Taha Anwar | `tahaanwar` | exec2@company.com | EXECUTIVE |
| Khizer Khan | `khizerkhan` | exec3@company.com | EXECUTIVE |
| Babar Khan | `babarkhan` | exec4@company.com | EXECUTIVE |

---

## Production (PRODUCTION) - 11 Users

| Name | Username | Email | Role |
|------|----------|-------|------|
| Abubakar Siddiqui | `abubakarsiddiqui` | prod1@company.com | PRODUCTION |
| Arshan Hasan | `arshanhasan` | prod2@company.com | PRODUCTION |
| Syed Taha | `syedtaha` | prod3@company.com | PRODUCTION |
| Syed Muslim | `syedmuslim` | prod4@company.com | PRODUCTION |
| Syed Rayyan | `syedrayyan` | prod5@company.com | PRODUCTION |
| Tahir Anwar | `tahiranwar` | prod6@company.com | PRODUCTION |
| Muhammad Bin Saud | `muhammadbinsaud` | prod7@company.com | PRODUCTION |
| Qasim Rizvi | `qasimrizvi` | prod8@company.com | PRODUCTION |
| Syed Akbar | `syedakbar` | prod9@company.com | PRODUCTION |
| Anas Khan | `anaskhan` | prod10@company.com | PRODUCTION |
| Shakeeb Khan | `shakeebkhan` | prod11@company.com | PRODUCTION |

---

## Login Instructions

### Username Login
You can login with the username in any of these formats:
- Exact: `azharrajput`
- With spaces: `azhar rajput`
- Any case: `AZHAR RAJPUT`, `Azhar Rajput`, `AzHaR RaJpUt`

The system automatically:
- Removes all spaces
- Converts to lowercase
- Matches against stored username

### API Endpoint
```
POST http://localhost:5000/api/auth/login
```

### Request Body
```json
{
  "username": "azharrajput",
  "password": "password123"
}
```

---

## Summary

- **Total Users:** 20
- **Project Managers:** 3
- **Team Leads:** 2
- **Executives:** 4
- **Production:** 11
- **Default Password:** password123

---

**Note:** For security, change all passwords in production environment.
