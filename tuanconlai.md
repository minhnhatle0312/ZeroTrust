# ROADMAP Tá»”NG THá»‚ Äá»’ ÃN IAM â€“ KEYCLOAK â€“ ZERO TRUST

> Äá»£t 6 â€” 09/11/2026: Ä‘Ã£ cháº¡y há»“i quy cÃ´ láº­p, sá»­a retention báº£o vá»‡ báº±ng chá»©ng sá»± cá»‘ vÃ  hoÃ n thiá»‡n tÃ i liá»‡u. Docker Engine/lab chÆ°a kháº£ dá»¥ng; MFA/SSO/PostgreSQL/HTTPS mÃ¡y khÃ¡ch thá»© hai chÆ°a Ä‘Æ°á»£c nghiá»‡m thu láº¡i. Xem [bÃ¡o cÃ¡o hiá»‡n hÃ nh](docs/BAO_CAO_NGHIEM_THU_ZERO_TRUST.md). CÃ¡c má»‘c/roadmap dÆ°á»›i Ä‘Ã¢y giá»¯ nhÆ° lá»‹ch sá»­, khÃ´ng Ä‘Æ°á»£c tá»± nÃ¢ng thÃ nh PASS.

**Äá»£t nÃ¢ng cáº¥p 2 â€” 09/11/2026:** hoÃ n thiá»‡n Ä‘Äƒng nháº­p A/B, tráº¡ng thÃ¡i phiÃªn/káº¿t ná»‘i, discovery vÃ  xÃ¡c nháº­n quyá»n trÆ°á»›c khi má»Ÿ app. 220 test cÃ´ láº­p, 25 kiá»ƒm tra browser vá»›i OIDC giáº£ vÃ  2 build Ä‘áº¡t. ChÆ°a xÃ¡c minh MFA/SSO trÃªn Keycloak tháº­t, khÃ´ng Ä‘á»•i dá»¯ liá»‡u hoáº·c cáº¥u hÃ¬nh Ä‘ang dÃ¹ng. Xem [bÃ¡o cÃ¡o Äá»£t 2](docs/KET_QUA_KIEM_THU_DOT_2.md). Dá»«ng chá» Äá»£t 3; cÃ¡c káº¿t quáº£ Äá»£t 1 vÃ  má»‘c nghiá»‡m thu cÅ© Ä‘Æ°á»£c giá»¯ riÃªng.

**Äá»£t nÃ¢ng cáº¥p 1 â€” 09/11/2026:** hoÃ n táº¥t kiá»ƒm kÃª Web A/B, báº£o vá»‡ Git index vÃ  gÃ³i source, chuáº©n bá»‹/cháº¡y kiá»ƒm thá»­ cÃ´ láº­p. File riÃªng tÆ°/runtime váº«n giá»¯ trÃªn mÃ¡y; khÃ´ng Ä‘á»•i credential hoáº·c dá»¯ liá»‡u lab. Xem [bÃ¡o cÃ¡o Äá»£t 1](docs/KET_QUA_KIEM_THU_DOT_1.md). ChÆ°a thá»±c hiá»‡n Äá»£t 2; khÃ´ng thay má»‘c nghiá»‡m thu liÃªn mÃ¡y/váº­n hÃ nh bÃªn dÆ°á»›i báº±ng káº¿t quáº£ unit test.

Timeline toÃ n bá»™ cÃ´ng viá»‡c cÃ²n láº¡i: Tuáº§n 5 â†’ Tuáº§n 10

**Cáº­p nháº­t 08/11/2026:** Ä‘Ã£ Ã¡p dá»¥ng vÃ  cháº¡y lab tuáº§n 5â€“10, sá»­a lá»—i tÃ­ch há»£p MFA/LDAP/Keycloak/Audit, kiá»ƒm thá»­ backend, giao diá»‡n, JCL local/LDAP, Detection vÃ  phá»¥c há»“i Audit. Xem [káº¿t quáº£ kiá»ƒm thá»­ 08/11/2026](docs/KET_QUA_KIEM_THU_2026_11_08.md). Má»‘c chÃ­nh thá»©c **4/6**; chÆ°a thay báº±ng chá»©ng mÃ¡y khÃ¡ch thá»© hai báº±ng kiá»ƒm thá»­ nhiá»u trÃ¬nh duyá»‡t trÃªn má»™t mÃ¡y.

Dá»±a trÃªn tÃ i liá»‡u triá»ƒn khai ngÃ y 04/11/2026 báº¡n Ä‘Ã£ gá»­i, mÃ¬nh xÃ¢y dá»±ng káº¿ hoáº¡ch tiáº¿p tá»¥c phÃ¡t triá»ƒn Nhá»‹p Workspace (Web A) vÃ  Nhá»‹p Security (Web B) Ä‘áº¿n khi hoÃ n thÃ nh Ä‘á»“ Ã¡n, bao gá»“m giao diá»‡n, chá»©c nÄƒng nghiá»‡p vá»¥, IAM, SSO, MFA, LDAP/Active Directory, Audit Log, phÃ¡t hiá»‡n báº¥t thÆ°á»ng, kiá»ƒm thá»­ vÃ  báº£o vá»‡.

## 1. Hiá»‡n tráº¡ng dá»± Ã¡n trÆ°á»›c tuáº§n 5

Theo tÃ i liá»‡u, nhÃ³m Ä‘Ã£ triá»ƒn khai hai website React, Keycloak/PostgreSQL báº±ng Docker, OIDC vá»›i PKCE S256, SSO hai chiá»u, RBAC theo vai trÃ²/nhÃ³m/chá»§ sá»Ÿ há»¯u, quáº£n lÃ½ ngÆ°á»i dÃ¹ng, phiÃªn, thÃ´ng bÃ¡o, audit báº±ng SQLite vÃ  HTTPS gateway. Bá»™ backend cÃ³ káº¿t quáº£ kiá»ƒm thá»­ gáº§n nháº¥t 97/97 Ä‘áº¡t; tuy nhiÃªn, MFA chÆ°a hoÃ n táº¥t kiá»ƒm thá»­ thá»±c táº¿, LDAP vÃ  Python Detection chÆ°a Ä‘Æ°á»£c triá»ƒn khai, Ä‘á»“ng thá»i chÆ°a cÃ³ Audit PostgreSQL táº­p trung.&#x20;

TAI_LIEU_TRIEN_KHAI_VA_KIEM_THU_CHI_TIET.md



Do Ä‘Ã³, tá»« tuáº§n 5 trá»Ÿ Ä‘i khÃ´ng lÃ m láº¡i Web A, Web B, Ä‘Äƒng nháº­p hoáº·c RBAC cÆ¡ báº£n, mÃ  phÃ¡t triá»ƒn trÃªn mÃ£ nguá»“n hiá»‡n táº¡i.

## 2. Tá»•ng quan timeline 6 tuáº§n

Lá»˜ TRÃŒNH Äá»€ XUáº¤T

## 6 tuáº§n phÃ¡t triá»ƒn cÃ²n láº¡i

Tuáº§n 5â€“10

TUáº¦N

## 5

MFA + Security Hardening + UI/UX

XÃ¡c thá»±c Ä‘a yáº¿u tá»‘, token, phiÃªn, nÃ¢ng cáº¥p hai Web

TUáº¦N

## 6

LDAP / Active Directory Federation

Äá»“ng bá»™ danh tÃ­nh doanh nghiá»‡p, nhÃ³m, vai trÃ²

TUáº¦N

## 7

Identity Lifecycle + Access Governance

Join/Change/Leave, phÃª duyá»‡t quyá»n, Ä‘á»“ng bá»™ tráº¡ng thÃ¡i

TUáº¦N

## 8

Centralized Audit & Security Monitoring

PostgreSQL Audit, log collector, dashboard giÃ¡m sÃ¡t

TUáº¦N

## 9

Anomaly Detection + Security Testing

Python Detection, test táº¥n cÃ´ng mÃ´ phá»ng, Ä‘Ã¡nh giÃ¡

TUáº¦N

## 10

Integration + Documentation + Defense

Kiá»ƒm thá»­ tá»•ng thá»ƒ, bÃ¡o cÃ¡o, slide vÃ  demo báº£o vá»‡

| Tuáº§n | Trá»ng tÃ¢m                  | Má»©c Ä‘á»™ khÃ³ | Má»‘c bÃ n giao                                     |
| ---- | -------------------------- | ---------- | ------------------------------------------------ |
| 5    | MFA, Session, UI/UX        | 7/10       | Hai Web hoÃ n thiá»‡n xÃ¡c thá»±c vÃ  giao diá»‡n         |
| 6    | LDAP/Active Directory      | 8/10       | NgÆ°á»i dÃ¹ng LDAP Ä‘Äƒng nháº­p vÃ  Ä‘Æ°á»£c cáº¥p Ä‘Ãºng quyá»n |
| 7    | JCL, quáº£n trá»‹ truy cáº­p     | 8/10       | Quy trÃ¬nh Join/Change/Leave Ä‘áº§y Ä‘á»§               |
| 8    | Audit PostgreSQL, giÃ¡m sÃ¡t | 8/10       | Audit táº­p trung, dashboard vÃ  cáº£nh bÃ¡o           |
| 9    | Python vÃ  kiá»ƒm thá»­ báº£o máº­t | 9/10       | Detection, test case, chá»‰ sá»‘ Ä‘Ã¡nh giÃ¡            |
| 10   | TÃ­ch há»£p vÃ  báº£o vá»‡         | 7/10       | Sáº£n pháº©m hoÃ n chá»‰nh, bÃ¡o cÃ¡o vÃ  demo             |

Má»©c Ä‘á»™ khÃ³ lÃ  Ä‘Ã¡nh giÃ¡ tÆ°Æ¡ng Ä‘á»‘i cho nhÃ³m hai sinh viÃªn. Lá»™ trÃ¬nh nÃ y khÃ¡ tham vá»ng; pháº§n Æ°u tiÃªn cao nháº¥t pháº£i Ä‘Æ°á»£c hoÃ n thÃ nh trÆ°á»›c khi bá»• sung cÃ¡c tÃ­nh nÄƒng má»Ÿ rá»™ng.

## 3. Tuáº§n 5 â€“ MFA, báº£o máº­t phiÃªn vÃ  nÃ¢ng cáº¥p giao diá»‡n toÃ n há»‡ thá»‘ng

Æ¯u tiÃªn cao nháº¥t

Má»¥c tiÃªu: HoÃ n thiá»‡n xÃ¡c thá»±c Ä‘a yáº¿u tá»‘ báº¯t buá»™c, báº£o vá»‡ token vÃ  session, nÃ¢ng cáº¥p Web A/Web B, Ä‘á»“ng thá»i báº£o Ä‘áº£m cÃ¡c chá»©c nÄƒng cÅ© khÃ´ng bá»‹ lá»—i.

### Timeline triá»ƒn khai tuáº§n 5

| Thá»i Ä‘iá»ƒm | CÃ´ng viá»‡c chi tiáº¿t                                                                      | Æ¯u tiÃªn |
| --------- | --------------------------------------------------------------------------------------- | ------- |
| NgÃ y 1    | Sao lÆ°u dá»± Ã¡n, kiá»ƒm tra Keycloak Authentication Flow, OTP Policy, báº¯t buá»™c Ä‘Äƒng kÃ½ TOTP | P0      |
| NgÃ y 2    | Kiá»ƒm thá»­ OTP, refresh token, logout, session revoke, tÃ i khoáº£n bá»‹ khÃ³a                  | P0      |
| NgÃ y 3    | Kiá»ƒm thá»­ láº¡i RBAC/IDOR; rÃ  soÃ¡t API, service account, chÃ­nh sÃ¡ch máº­t kháº©u               | P0      |
| NgÃ y 4    | NÃ¢ng cáº¥p Dashboard, lá»‹ch cÃ´ng, há»“ sÆ¡ vÃ  giao diá»‡n báº£o máº­t Web A                         | P1      |
| NgÃ y 5    | NÃ¢ng cáº¥p Security Dashboard, biá»ƒu Ä‘á»“, cáº£nh bÃ¡o vÃ  Audit Viewer cá»§a Web B                | P1      |
| NgÃ y 6    | Kiá»ƒm thá»­ HTTPS LAN hai mÃ¡y, security headers, cáº¥u hÃ¬nh gateway vÃ  Keycloak              | P0      |
| NgÃ y 7    | Cháº¡y regression test, sá»­a lá»—i, chá»¥p minh chá»©ng, viáº¿t bÃ¡o cÃ¡o tuáº§n 5                     | P0      |

### CÃ¡c chá»©c nÄƒng pháº£i hoÃ n thÃ nh

Keycloak & Authentication

- Báº¯t buá»™c ngÆ°á»i dÃ¹ng má»›i Ä‘Äƒng kÃ½ TOTP vÃ  hoÃ n thÃ nh MFA.
- Kiá»ƒm thá»­ OTP há»£p lá»‡, sai, quÃ¡ cá»­a sá»• thá»i gian cho phÃ©p, hoáº·c bá» qua bÆ°á»›c xÃ¡c thá»±c.
- Cáº¥u hÃ¬nh Browser Flow Ä‘Ãºng cho ngÆ°á»i dÃ¹ng chÆ°a Ä‘Äƒng kÃ½ MFA.
- Bá»• sung quy trÃ¬nh reset hoáº·c thay Ä‘á»•i thiáº¿t bá»‹ MFA an toÃ n.
- Kiá»ƒm thá»­ MFA khi Ä‘Äƒng nháº­p Web A vÃ  SSO sang Web B.
- PhÃ¢n biá»‡t Ä‘Äƒng nháº­p láº¡i báº±ng phiÃªn SSO vÃ  Ä‘Äƒng nháº­p báº±ng máº­t kháº©u má»›i.

LÆ°u Ã½: chá»‰ báº­t `CONFIGURE_TOTP` khÃ´ng Ä‘á»§ Ä‘á»ƒ chá»©ng minh chÃ­nh sÃ¡ch MFA báº¯t buá»™c Ä‘Ã£ Ä‘Æ°á»£c Ã¡p dá»¥ng cho má»i luá»“ng. NgoÃ i ra, TOTP tiÃªu chuáº©n cÃ³ thá»ƒ Ä‘Æ°á»£c cháº¥p nháº­n nhiá»u láº§n trong cá»­a sá»• cÃ²n hiá»‡u lá»±c tÃ¹y cáº¥u hÃ¬nh, nÃªn khÃ´ng tá»± Ä‘áº·t tiÃªu chÃ­ "mÃ£ Ä‘Ã£ dÃ¹ng pháº£i bá»‹ tá»« chá»‘i" náº¿u chÆ°a cÃ³ cÆ¡ cháº¿ chá»‘ng tÃ¡i sá»­ dá»¥ng.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.keycloak.org\&sz=32)

Keycloak



Backend & Security

- Kiá»ƒm tra token háº¿t háº¡n vÃ  refresh token.
- Kiá»ƒm tra thu há»“i token sau Ä‘á»•i Role, disable tÃ i khoáº£n, logout.
- Kiá»ƒm tra chÃ­nh sÃ¡ch 401/403/429/503 vÃ  cÃ¡c thÃ´ng bÃ¡o lá»—i.
- RÃ  soÃ¡t viá»‡c xÃ¡c minh `issuer`, `audience`, `azp`, chá»¯ kÃ½ vÃ  phiÃªn.
- RÃ  soÃ¡t Least Privilege cá»§a tÃ i khoáº£n service `attendance-control`.
- Kiá»ƒm thá»­ lá»—i Keycloak khÃ´ng káº¿t ná»‘i Ä‘Æ°á»£c, trÃ¡nh tá»± cho phÃ©p truy cáº­p.
- Kiá»ƒm tra session cache vÃ  Ä‘á»“ng bá»™ tráº¡ng thÃ¡i phiÃªn giá»¯a hai Web.

Trong há»‡ thá»‘ng hiá»‡n táº¡i, tÃ i liá»‡u mÃ´ táº£ backend cache tráº¡ng thÃ¡i phiÃªn tá»‘i Ä‘a 5 giÃ¢y, frontend kiá»ƒm tra khoáº£ng 15 giÃ¢y vÃ  access token 300 giÃ¢y. ÄÃ¢y lÃ  cÃ¡c thÃ´ng sá»‘ cáº§n Ä‘o láº¡i sau khi thay Ä‘á»•i MFA hoáº·c chÃ­nh sÃ¡ch phiÃªn.&#x20;

TAI_LIEU_TRIEN_KHAI_VA_KIEM_THU_CHI_TIET.md



Web A â€“ Nhá»‹p Workspace

- Dashboard cÃ¡ nhÃ¢n hÃ³a theo Employee, Manager, Admin, Auditor.
- Biá»ƒu Ä‘á»“ cháº¥m cÃ´ng tuáº§n/thÃ¡ng, lá»‹ch cÃ´ng vÃ  tá»•ng há»£p ngÃ y Ä‘i muá»™n.
- Trang Security Settings: tráº¡ng thÃ¡i MFA, phiÃªn hoáº¡t Ä‘á»™ng, lá»‹ch sá»­ Ä‘Äƒng nháº­p.
- Giao diá»‡n Ä‘á»•i máº­t kháº©u vÃ  yÃªu cáº§u reset MFA.
- Cáº£i thiá»‡n báº£ng cÃ´ng, quy trÃ¬nh duyá»‡t Ä‘Æ¡n vÃ  thÃ´ng bÃ¡o.
- Chuáº©n hÃ³a responsive, loading skeleton, toast, modal xÃ¡c nháº­n.

Web B â€“ Nhá»‹p Security

- KPI: Ä‘Äƒng nháº­p thÃ nh cÃ´ng/tháº¥t báº¡i, ALLOW/DENY, tÃ i khoáº£n khÃ³a, phiÃªn hoáº¡t Ä‘á»™ng.
- Biá»ƒu Ä‘á»“ sá»± kiá»‡n theo thá»i gian.
- Lá»c theo ngÆ°á»i dÃ¹ng, Role, IP, Client vÃ  má»©c cáº£nh bÃ¡o.
- Trang chi tiáº¿t sá»± kiá»‡n cÃ³ timeline vÃ  request ID.
- Dashboard tráº¡ng thÃ¡i báº£o máº­t cá»§a tá»«ng tÃ i khoáº£n.
- MÃ n hÃ¬nh tráº¡ng thÃ¡i cÃ¡c thÃ nh pháº§n há»‡ thá»‘ng (dÃ¹ng dá»¯ liá»‡u cÃ³ thá»ƒ xÃ¡c minh).

### Nghiá»‡m thu tuáº§n 5

Pháº£i Ä‘áº¡t trÆ°á»›c khi chuyá»ƒn sang tuáº§n 6:

- MFA thá»±c táº¿ hoáº¡t Ä‘á»™ng trÃªn cáº£ Web A vÃ  Web B.
- SSO khÃ´ng bá»‹ há»ng sau khi bá»• sung MFA.
- Token cÅ© bá»‹ xá»­ lÃ½ Ä‘Ãºng theo chÃ­nh sÃ¡ch thu há»“i Ä‘Ã£ thiáº¿t káº¿.
- CÃ¡c test RBAC, IDOR vÃ  quáº£n lÃ½ phiÃªn váº«n Ä‘áº¡t.
- Giao diá»‡n Web A/B hoáº¡t Ä‘á»™ng tá»‘t trÃªn desktop vÃ  mobile.
- CÃ³ báº±ng chá»©ng truy cáº­p HTTPS vÃ  Ä‘Äƒng nháº­p tá»« mÃ¡y khÃ¡ch thá»© hai.
- CÃ³ bÃ¡o cÃ¡o tuáº§n 5, video hoáº·c áº£nh minh chá»©ng.

## 4. Tuáº§n 6 â€“ LDAP/Active Directory vÃ  Ä‘á»“ng bá»™ danh tÃ­nh doanh nghiá»‡p

Äá»™ khÃ³ 8/10

Má»¥c tiÃªu: Chuyá»ƒn tá»« mÃ´ hÃ¬nh danh tÃ­nh chá»‰ do Keycloak quáº£n lÃ½ sang mÃ´ hÃ¬nh cÃ³ nguá»“n danh tÃ­nh doanh nghiá»‡p báº±ng LDAP/AD.

### Timeline tuáº§n 6

| Thá»i Ä‘iá»ƒm | CÃ´ng viá»‡c                                                              | Æ¯u tiÃªn |
| --------- | ---------------------------------------------------------------------- | ------- |
| NgÃ y 1    | Thiáº¿t káº¿ LDAP Directory, OU, User, Group, sÆ¡ Ä‘á»“ Ä‘á»“ng bá»™                | P0      |
| NgÃ y 2    | Triá»ƒn khai OpenLDAP trong Docker hoáº·c AD DS trÃªn VM                    | P0      |
| NgÃ y 3    | Cáº¥u hÃ¬nh Keycloak User Federation, test káº¿t ná»‘i vÃ  Import Users        | P0      |
| NgÃ y 4    | Ãnh xáº¡ LDAP Group sang Keycloak Group/Role                             | P0      |
| NgÃ y 5    | Kiá»ƒm thá»­ Ä‘á»•i thuá»™c tÃ­nh, Ä‘á»•i nhÃ³m, disable tÃ i khoáº£n, lá»—i Ä‘á»“ng bá»™      | P0      |
| NgÃ y 6    | Bá»• sung giao diá»‡n Directory Management vÃ  Federation Status trÃªn Web B | P1      |
| NgÃ y 7    | Kiá»ƒm thá»­ LDAP, lÆ°u minh chá»©ng vÃ  bÃ¡o cÃ¡o tuáº§n 6                        | P0      |

### Thiáº¿t káº¿ danh tÃ­nh

VÃ­ dá»¥ cáº¥u trÃºc LDAP:

```
dc=company,dc=local
â”œâ”€â”€ ou=people
â”‚   â”œâ”€â”€ uid=employee01
â”‚   â”œâ”€â”€ uid=employee02
â”‚   â”œâ”€â”€ uid=manager01
â”‚   â””â”€â”€ uid=auditor01
â””â”€â”€ ou=groups
    â”œâ”€â”€ cn=employees
    â”œâ”€â”€ cn=managers
    â””â”€â”€ cn=auditors
```

CÃ¡c háº¡ng má»¥c triá»ƒn khai:

- Táº¡o LDAP Server vÃ  tÃ i khoáº£n quáº£n trá»‹ dá»‹ch vá»¥ riÃªng.
- Cáº¥u hÃ¬nh Base DN, Bind DN, User Search Filter.
- Káº¿t ná»‘i Keycloak User Federation.
- Cáº¥u hÃ¬nh LDAP Mapper cho username, email, tÃªn vÃ  nhÃ³m.
- Äá»“ng bá»™ ngÆ°á»i dÃ¹ng vÃ  kiá»ƒm tra Ä‘Äƒng nháº­p.
- PhÃ¢n quyá»n theo nhÃ³m LDAP vÃ  chÃ­nh sÃ¡ch á»©ng dá»¥ng.
- Kiá»ƒm tra trÆ°á»ng há»£p ngÆ°á»i dÃ¹ng chuyá»ƒn nhÃ³m.
- Kiá»ƒm tra Keycloak khi LDAP táº¡m thá»i ngá»«ng hoáº¡t Ä‘á»™ng.
- Thiáº¿t káº¿ chÃ­nh sÃ¡ch Ä‘á»“ng bá»™ vÃ  hiá»ƒn thá»‹ lá»—i.

Quyáº¿t Ä‘á»‹nh kiáº¿n trÃºc quan trá»ng: NÃªn coi LDAP lÃ  nguá»“n dá»¯ liá»‡u gá»‘c cho thuá»™c tÃ­nh danh tÃ­nh Ä‘Æ°á»£c quáº£n lÃ½ táº¡i LDAP; Keycloak vÃ  á»©ng dá»¥ng chá»‰ quáº£n lÃ½ nhá»¯ng dá»¯ liá»‡u Ä‘Æ°á»£c phÃ©p. Pháº£i xÃ¡c Ä‘á»‹nh rÃµ cháº¿ Ä‘á»™ `READ_ONLY`, `WRITABLE` hoáº·c `UNSYNCED`, vÃ¬ chÃºng cÃ³ hÃ nh vi cáº­p nháº­t khÃ¡c nhau.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.keycloak.org\&sz=32)

Keycloak



### NÃ¢ng cáº¥p Web B trong tuáº§n 6

Directory Users

Danh sÃ¡ch ngÆ°á»i dÃ¹ng LDAP, nguá»“n danh tÃ­nh, tráº¡ng thÃ¡i, nhÃ³m, vai trÃ² Ä‘Æ°á»£c Ã¡nh xáº¡ vÃ  láº§n Ä‘á»“ng bá»™ cuá»‘i.

Federation Sync

Tráº¡ng thÃ¡i LDAP Connection, sá»‘ ngÆ°á»i dÃ¹ng Ä‘Æ°á»£c Ä‘á»“ng bá»™, lá»—i vÃ  thá»i gian Ä‘á»“ng bá»™ gáº§n nháº¥t.

Group Mapping

TrÃ¬nh bÃ y quan há»‡ LDAP Group â†’ Keycloak Group/Role â†’ Web Resource vÃ  cÃ¡c xung Ä‘á»™t cáº§n xá»­ lÃ½.

### Nghiá»‡m thu tuáº§n 6

CÃ³ tÃ i khoáº£n LDAP Ä‘Äƒng nháº­p Keycloak thÃ nh cÃ´ng; thay Ä‘á»•i nhÃ³m dáº«n Ä‘áº¿n thay Ä‘á»•i quyá»n sau quÃ¡ trÃ¬nh Ä‘á»“ng bá»™ phÃ¹ há»£p; tÃ i khoáº£n bá»‹ vÃ´ hiá»‡u hÃ³a khÃ´ng thá»ƒ Ä‘Äƒng nháº­p má»›i; cÃ¡c tráº¡ng thÃ¡i vÃ  sá»± kiá»‡n cÃ³ minh chá»©ng.

Náº¿u nhÃ³m chá»‰ cÃ³ mÃ¡y 16 GB RAM, nÃªn Æ°u tiÃªn OpenLDAP trÃªn Docker. Windows AD DS lÃ  pháº§n má»Ÿ rá»™ng sau khi Federation Ä‘Ã£ cháº¡y á»•n Ä‘á»‹nh.

## 5. Tuáº§n 7 â€“ Join/Change/Leave vÃ  Access Governance nÃ¢ng cao

Äá»™ khÃ³ 8/10

Má»¥c tiÃªu: XÃ¢y dá»±ng vÃ²ng Ä‘á»i danh tÃ­nh cÃ³ kiá»ƒm soÃ¡t tá»« khi nhÃ¢n viÃªn gia nháº­p, thay Ä‘á»•i bá»™ pháº­n/quyá»n Ä‘áº¿n khi nghá»‰ viá»‡c.

Trong tÃ i liá»‡u hiá»‡n táº¡i, há»‡ thá»‘ng Ä‘Ã£ cÃ³ chá»©c nÄƒng táº¡o nhÃ¢n viÃªn, thay Ä‘á»•i há»“ sÆ¡ vÃ  Role, khÃ³a/má»Ÿ tÃ i khoáº£n, thu há»“i phiÃªn. VÃ¬ váº­y, tuáº§n 7 táº­p trung hoÃ n thiá»‡n quy trÃ¬nh Ä‘áº§u-cuá»‘i, nguá»“n dá»¯ liá»‡u LDAP vÃ  quáº£n trá»‹ phÃª duyá»‡t, khÃ´ng láº­p trÃ¬nh láº¡i CRUD tÃ i khoáº£n.&#x20;

TAI_LIEU_TRIEN_KHAI_VA_KIEM_THU_CHI_TIET.md



### Timeline tuáº§n 7

| Thá»i Ä‘iá»ƒm | CÃ´ng viá»‡c                                           | Æ¯u tiÃªn |
| --------- | --------------------------------------------------- | ------- |
| NgÃ y 1    | Thiáº¿t káº¿ luá»“ng JCL tÃ­ch há»£p LDAPâ€“Keycloakâ€“Web       | P0      |
| NgÃ y 2    | HoÃ n thiá»‡n Join vÃ  cáº¥p quyá»n máº·c Ä‘á»‹nh               | P0      |
| NgÃ y 3    | HoÃ n thiá»‡n Change, kiá»ƒm soÃ¡t quyá»n cÅ©/má»›i           | P0      |
| NgÃ y 4    | HoÃ n thiá»‡n Leave, thu há»“i phiÃªn vÃ  vÃ´ hiá»‡u hÃ³a      | P0      |
| NgÃ y 5    | ThÃªm yÃªu cáº§u cáº¥p quyá»n vÃ  phÃª duyá»‡t                 | P1      |
| NgÃ y 6    | Dashboard JCL, lá»‹ch sá»­ vÃ  cÃ´ng cá»¥ xá»­ lÃ½ Ä‘á»“ng bá»™ lá»—i | P1      |
| NgÃ y 7    | Test toÃ n bá»™ JCL, lÆ°u báº±ng chá»©ng vÃ  bÃ¡o cÃ¡o         | P0      |

### Chá»©c nÄƒng má»Ÿ rá»™ng

| Module          | CÃ´ng viá»‡c cáº§n thá»±c hiá»‡n                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Join            | Táº¡o nhÃ¢n viÃªn, gÃ¡n phÃ²ng ban/nhÃ³m, cáº¥p Role máº·c Ä‘á»‹nh, gá»­i thÃ´ng bÃ¡o, báº¯t buá»™c Ä‘á»•i máº­t kháº©u/MFA |
| Change          | Thay Ä‘á»•i nhÃ³m, chuyá»ƒn Role, thu há»“i quyá»n cÅ©, Ä‘á»“ng bá»™ Keycloak vÃ  LDAP                         |
| Leave           | Disable tÃ i khoáº£n, thu há»“i phiÃªn, tá»« chá»‘i API, lÆ°u lá»‹ch sá»­ vÃ  lÃ½ do                            |
| Access Request  | NgÆ°á»i dÃ¹ng yÃªu cáº§u thÃªm quyá»n hoáº·c truy cáº­p tÃ i nguyÃªn                                         |
| Access Approval | Manager/Admin xÃ©t duyá»‡t yÃªu cáº§u theo pháº¡m vi Ä‘Æ°á»£c phÃ©p                                         |
| Access Review   | Admin/Auditor rÃ  soÃ¡t quyá»n cáº¥p quÃ¡ má»©c hoáº·c lÃ¢u khÃ´ng sá»­ dá»¥ng                                 |
| Sync Recovery   | Äá»‘i chiáº¿u tráº¡ng thÃ¡i `PENDING`, `PARTIAL`, `FAILED`, `SYNCED`                                  |
| History         | Timeline thay Ä‘á»•i cá»§a tá»«ng tÃ i khoáº£n                                                           |
| Notification    | ThÃ´ng bÃ¡o thay Ä‘á»•i quyá»n, vÃ´ hiá»‡u hÃ³a, yÃªu cáº§u chá» duyá»‡t                                       |

### Giao diá»‡n nÃªn xÃ¢y dá»±ng

Web A: Trang yÃªu cáº§u quyá»n, theo dÃµi tráº¡ng thÃ¡i phÃª duyá»‡t, lá»‹ch sá»­ quyá»n cÃ¡ nhÃ¢n vÃ  thÃ´ng bÃ¡o.

Web B: Access Governance Dashboard, Permission Matrix, báº£ng quy trÃ¬nh Join/Change/Leave, lá»‹ch sá»­ thay Ä‘á»•i, mÃ n hÃ¬nh xá»­ lÃ½ lá»—i Ä‘á»“ng bá»™ vÃ  quáº£n lÃ½ yÃªu cáº§u chá» duyá»‡t.

VÃ­ dá»¥ minh chá»©ng JCL

JOIN

Táº¡o + cáº¥p quyá»n

CHANGE

Äá»•i nhÃ³m / Role

LEAVE

KhÃ³a + thu há»“i

Vá»›i má»—i tráº¡ng thÃ¡i, pháº£i cÃ³ API response, quyá»n thá»±c táº¿, Keycloak/LDAP state vÃ  Audit Log tÆ°Æ¡ng á»©ng.

### Nghiá»‡m thu tuáº§n 7

Thá»±c hiá»‡n má»™t ká»‹ch báº£n Ä‘áº§y Ä‘á»§: nhÃ¢n viÃªn má»›i Ä‘Æ°á»£c táº¡o â†’ Ä‘Äƒng nháº­p MFA â†’ Ä‘Æ°á»£c chuyá»ƒn phÃ²ng ban â†’ quyá»n cÅ© bá»‹ tá»« chá»‘i â†’ quyá»n má»›i Ä‘Æ°á»£c cáº¥p â†’ nghá»‰ viá»‡c â†’ khÃ´ng cÃ²n truy cáº­p Ä‘Æ°á»£c API theo chÃ­nh sÃ¡ch thu há»“i.

Äáº·c biá»‡t, cáº§n kiá»ƒm thá»­ trÆ°á»ng há»£p Ä‘á»“ng bá»™ LDAP/Keycloak tháº¥t báº¡i giá»¯a chá»«ng vÃ  há»‡ thá»‘ng khÃ´ng bÃ¡o thÃ nh cÃ´ng giáº£.

## 6. Tuáº§n 8 â€“ Centralized Audit, PostgreSQL vÃ  Security Monitoring

Háº¡ng má»¥c quan trá»ng cho Ä‘á»“ Ã¡n

Má»¥c tiÃªu: XÃ¢y dá»±ng há»‡ thá»‘ng ghi nháº­n, lÆ°u trá»¯, tÃ¬m kiáº¿m vÃ  giÃ¡m sÃ¡t sá»± kiá»‡n táº­p trung, thay tháº¿ viá»‡c phá»¥ thuá»™c hoÃ n toÃ n vÃ o Audit Log SQLite hiá»‡n táº¡i.

Há»‡ thá»‘ng Ä‘ang cÃ³ collector láº¥y sá»± kiá»‡n Keycloak khoáº£ng 30 giÃ¢y/láº§n, nhÆ°ng chÆ°a cÃ³ cÆ¡ cháº¿ láº¥y bÃ¹ Ä‘áº§y Ä‘á»§ khi máº¥t káº¿t ná»‘i hoáº·c lÆ°á»£ng sá»± kiá»‡n vÆ°á»£t giá»›i háº¡n cá»§a má»™t lÆ°á»£t. VÃ¬ váº­y, Ä‘Ã¢y lÃ  pháº§n cáº§n cáº£i thiá»‡n rÃµ rá»‡t trong tuáº§n 8.&#x20;

TAI_LIEU_TRIEN_KHAI_VA_KIEM_THU_CHI_TIET.md



### Timeline tuáº§n 8

| Thá»i Ä‘iá»ƒm | CÃ´ng viá»‡c                                                    | Æ¯u tiÃªn |
| --------- | ------------------------------------------------------------ | ------- |
| NgÃ y 1    | Thiáº¿t káº¿ cÆ¡ sá»Ÿ dá»¯ liá»‡u Audit PostgreSQL, event schema        | P0      |
| NgÃ y 2    | XÃ¢y dá»±ng Audit Service vÃ  káº¿t ná»‘i PostgreSQL                 | P0      |
| NgÃ y 3    | Äá»“ng bá»™ Keycloak Events, Admin Events, Web A/B Access Log    | P0      |
| NgÃ y 4    | Chá»‘ng trÃ¹ng log, retry, checkpoint, backfill, retention      | P0      |
| NgÃ y 5    | PhÃ¡t triá»ƒn Security Monitoring Dashboard                     | P1      |
| NgÃ y 6    | Cáº£nh bÃ¡o theo luáº­t, thá»‘ng kÃª, xuáº¥t bÃ¡o cÃ¡o, Ä‘iá»u tra sá»± kiá»‡n | P1      |
| NgÃ y 7    | Kiá»ƒm thá»­ Audit, Ä‘á»‘i chiáº¿u dá»¯ liá»‡u, bÃ¡o cÃ¡o tuáº§n 8            | P0      |

### Há»‡ thá»‘ng Audit táº­p trung

Kiáº¿n trÃºc má»¥c tiÃªu tuáº§n 8. TÃ¡ch dá»¯ liá»‡u Audit cá»§a á»©ng dá»¥ng khá»i cÆ¡ sá»Ÿ dá»¯ liá»‡u ná»™i bá»™ Keycloak vÃ  giá»¯ SQLite hiá»‡n táº¡i trong quÃ¡ trÃ¬nh chuyá»ƒn Ä‘á»•i an toÃ n.

### CÃ¡c module cáº§n phÃ¡t triá»ƒn

| Module              | Chá»©c nÄƒng                                   |
| ------------------- | ------------------------------------------- |
| Event Collector     | Thu tháº­p sá»± kiá»‡n Keycloak, Web A/B          |
| Audit Storage       | LÆ°u sá»± kiá»‡n vÃ o PostgreSQL                  |
| Event Normalizer    | Chuáº©n hÃ³a User ID, IP, Event, Time, Client  |
| Request Correlation | GhÃ©p cÃ¡c sá»± kiá»‡n theo request ID/session ID |
| Retention Policy    | Quáº£n lÃ½ thá»i háº¡n giá»¯ log                    |
| Alert Rules         | Äáº·t ngÆ°á»¡ng cáº£nh bÃ¡o                         |
| Audit Search        | TÃ¬m kiáº¿m, lá»c, phÃ¢n trang theo thá»i gian    |
| Investigation       | Má»Ÿ chi tiáº¿t vÃ  truy váº¿t sá»± kiá»‡n             |
| Reports             | Thá»‘ng kÃª, xuáº¥t CSV vÃ  tá»•ng há»£p an ninh      |

Má»™t báº£n ghi Audit nÃªn cÃ³ cÃ¡c trÆ°á»ng chÃ­nh: `event_id`, `timestamp`, `source`, `user_id`, `client_id`, `session_id` (náº¿u cÃ³), `action`, `resource`, `decision`, `http_status`, `ip_address`, `request_id` vÃ  `details` Ä‘Ã£ Ä‘Æ°á»£c lá»c thÃ´ng tin nháº¡y cáº£m.

KhÃ´ng nÃªn ghi access token, refresh token, máº­t kháº©u, OTP hay secret vÃ o báº£ng Audit.

### Má»Ÿ rá»™ng giao diá»‡n Web B

- Security Overview vá»›i biá»ƒu Ä‘á»“ ALLOW/DENY.
- Authentication Analytics theo thá»i gian.
- Account Activity Timeline.
- Incident & Alert Management.
- Top tÃ i khoáº£n cÃ³ nhiá»u láº§n Ä‘Äƒng nháº­p tháº¥t báº¡i.
- Federation Health vÃ  Audit Collector Health.
- BÃ¡o cÃ¡o lá»‹ch sá»­ cáº¥p/thu há»“i quyá»n.
- Trang xuáº¥t dá»¯ liá»‡u phá»¥c vá»¥ kiá»ƒm toÃ¡n.

### Nghiá»‡m thu tuáº§n 8

Ãt nháº¥t má»™t sá»± kiá»‡n Ä‘Äƒng nháº­p, má»™t yÃªu cáº§u ALLOW, má»™t yÃªu cáº§u DENY vÃ  má»™t thao tÃ¡c thay Ä‘á»•i Role pháº£i truy xuáº¥t Ä‘Æ°á»£c tá»« PostgreSQL, Ä‘á»‘i chiáº¿u Ä‘Æ°á»£c nguá»“n vÃ  thá»i Ä‘iá»ƒm.

NgoÃ i ra, pháº£i chá»©ng minh collector khÃ´ng ghi trÃ¹ng khi cháº¡y láº¡i vÃ  há»‡ thá»‘ng xá»­ lÃ½ minh báº¡ch cÃ¡c tÃ¬nh huá»‘ng máº¥t káº¿t ná»‘i. KhÃ´ng tuyÃªn bá»‘ báº£o Ä‘áº£m khÃ´ng máº¥t log náº¿u chÆ°a kiá»ƒm thá»­ vÃ  thiáº¿t káº¿ Ä‘Æ°á»£c cÆ¡ cháº¿ khÃ´i phá»¥c tÆ°Æ¡ng á»©ng.

## 7. Tuáº§n 9 â€“ Python Anomaly Detection vÃ  kiá»ƒm thá»­ báº£o máº­t toÃ n diá»‡n

Äá»™ khÃ³ cao nháº¥t â€“ 9/10

Má»¥c tiÃªu: PhÃ¡t hiá»‡n hÃ nh vi báº¥t thÆ°á»ng dá»±a trÃªn dá»¯ liá»‡u Audit vÃ  chá»©ng minh má»©c Ä‘á»™ báº£o vá»‡ cá»§a há»‡ thá»‘ng báº±ng bá»™ kiá»ƒm thá»­ ká»¹ thuáº­t.

### Timeline tuáº§n 9

| Thá»i Ä‘iá»ƒm | CÃ´ng viá»‡c                                                 | Æ¯u tiÃªn |
| --------- | --------------------------------------------------------- | ------- |
| NgÃ y 1    | Thu tháº­p vÃ  gÃ¡n nhÃ£n dá»¯ liá»‡u Audit Log                    | P0      |
| NgÃ y 2    | Xá»­ lÃ½ dá»¯ liá»‡u, xÃ¢y dá»±ng Ä‘áº·c trÆ°ng phÃ¡t hiá»‡n               | P0      |
| NgÃ y 3    | Python Detection theo luáº­t, thá»­ mÃ´ hÃ¬nh ML náº¿u Ä‘á»§ dá»¯ liá»‡u | P0/P1   |
| NgÃ y 4    | TÃ­ch há»£p káº¿t quáº£ Normal/Anomaly vÃ o Web B                 | P0      |
| NgÃ y 5    | ÄÃ¡nh giÃ¡ Precision/Recall/F1, False Positive Rate, Ä‘á»™ trá»… | P0      |
| NgÃ y 6    | Kiá»ƒm thá»­ RBAC, MFA, LDAP, SSO, token, JCL, audit, API     | P0      |
| NgÃ y 7    | Sá»­a lá»—i, kiá»ƒm thá»­ há»“i quy, viáº¿t bÃ¡o cÃ¡o tuáº§n 9            | P0      |

### XÃ¢y dá»±ng Python Detection

Äá» xuáº¥t hai táº§ng phÃ¡t hiá»‡n:

Táº§ng 1 â€“ Rule-based Detection (báº¯t buá»™c)

- Nhiá»u láº§n Ä‘Äƒng nháº­p tháº¥t báº¡i trong khoáº£ng thá»i gian ngáº¯n.
- Thá»­ truy cáº­p API Admin báº±ng tÃ i khoáº£n Employee.
- Nhiá»u sá»± kiá»‡n DENY liÃªn tiáº¿p.
- Truy cáº­p tá»« IP má»›i (tÃ­n hiá»‡u cáº§n kiá»ƒm tra, khÃ´ng máº·c Ä‘á»‹nh lÃ  táº¥n cÃ´ng).
- Truy cáº­p ngoÃ i khung giá» nghiá»‡p vá»¥.
- Sá»­ dá»¥ng láº¡i token Ä‘Ã£ bá»‹ thu há»“i.
- TÄƒng Ä‘á»™t biáº¿n sá»‘ yÃªu cáº§u tá»« má»™t tÃ i khoáº£n.

Táº§ng 2 â€“ Machine Learning (má»Ÿ rá»™ng)

CÃ³ thá»ƒ thá»­ Isolation Forest hoáº·c thuáº­t toÃ¡n khÃ¡c phÃ¹ há»£p vá»›i dá»¯ liá»‡u thá»±c nghiá»‡m. Äáº·c trÆ°ng Ä‘áº§u vÃ o cÃ³ thá»ƒ gá»“m sá»‘ láº§n tháº¥t báº¡i, máº­t Ä‘á»™ request, thá»i gian truy cáº­p, tá»· lá»‡ DENY vÃ  sá»‘ tÃ i nguyÃªn khÃ¡c nhau Ä‘Æ°á»£c yÃªu cáº§u.

KhÃ´ng nÃªn coi káº¿t quáº£ Rule-based lÃ  dá»¯ liá»‡u nhÃ£n duy nháº¥t Ä‘á»ƒ Ä‘Ã¡nh giÃ¡ chÃ­nh mÃ´ hÃ¬nh Rule-based, vÃ¬ sáº½ táº¡o káº¿t quáº£ Ä‘o thiáº¿u Ä‘á»™c láº­p.

### Chá»‰ sá»‘ Ä‘Ã¡nh giÃ¡

| Chá»‰ sá»‘              | Má»¥c Ä‘Ã­ch                                            |
| ------------------- | --------------------------------------------------- |
| Precision           | Trong cÃ¡c cáº£nh bÃ¡o, bao nhiÃªu lÃ  báº¥t thÆ°á»ng tháº­t    |
| Recall              | Trong cÃ¡c báº¥t thÆ°á»ng tháº­t, phÃ¡t hiá»‡n Ä‘Æ°á»£c bao nhiÃªu |
| F1-score            | CÃ¢n báº±ng giá»¯a Precision vÃ  Recall                   |
| False Positive Rate | Tá»· lá»‡ hoáº¡t Ä‘á»™ng bÃ¬nh thÆ°á»ng bá»‹ cáº£nh bÃ¡o nháº§m        |
| Detection Latency   | Thá»i gian tá»« sá»± kiá»‡n Ä‘áº¿n khi cáº£nh bÃ¡o xuáº¥t hiá»‡n     |
| Processing Time     | Thá»i gian xá»­ lÃ½ khá»‘i lÆ°á»£ng dá»¯ liá»‡u                  |

NÃªn chia táº­p dá»¯ liá»‡u kiá»ƒm thá»­ riÃªng, trÃ¡nh Ä‘á»ƒ cÃ¡c sá»± kiá»‡n gáº§n nhÆ° trÃ¹ng nhau xuáº¥t hiá»‡n Ä‘á»“ng thá»i trong táº­p huáº¥n luyá»‡n vÃ  táº­p Ä‘Ã¡nh giÃ¡.

### Kiá»ƒm thá»­ báº£o máº­t toÃ n há»‡ thá»‘ng

| NhÃ³m test        | Ká»‹ch báº£n cáº§n thá»±c hiá»‡n                                       |
| ---------------- | ------------------------------------------------------------ |
| Authentication   | MFA Ä‘Ãºng/sai, token khÃ´ng há»£p lá»‡, háº¿t háº¡n                    |
| Authorization    | RBAC, quyá»n theo nhÃ³m, truy cáº­p Ä‘á»‘i tÆ°á»£ng khÃ´ng thuá»™c sá»Ÿ há»¯u |
| SSO              | Login, logout vÃ  thu há»“i phiÃªn hai chiá»u                     |
| LDAP             | Äá»“ng bá»™ nhÃ³m, tÃ i khoáº£n bá»‹ khÃ³a, dá»‹ch vá»¥ LDAP lá»—i            |
| JCL              | Join, Change, Leave vÃ  lá»—i giá»¯a cÃ¡c bÆ°á»›c Ä‘á»“ng bá»™             |
| Input            | JSON lá»—i, dá»¯ liá»‡u khÃ´ng há»£p lá»‡, mass assignment              |
| Security Headers | CORS, CSP, HTTPS, Host/Proxy                                 |
| Rate Limiting    | Giá»›i háº¡n sá»‘ lÆ°á»£ng request vÃ  login throttling                |
| Audit            | Log Ä‘áº§y Ä‘á»§, Ä‘Ãºng actor, Ä‘Ãºng request ID                      |
| Reliability      | Keycloak/PostgreSQL/LDAP bá»‹ ngáº¯t káº¿t ná»‘i                     |
| Data Integrity   | KhÃ´ng cÃ³ thay Ä‘á»•i dá»¯ liá»‡u trÃ¡i quyá»n                         |
| Recovery         | Backup/restore, xá»­ lÃ½ thao tÃ¡c chÆ°a Ä‘á»“ng bá»™                  |

CÃ³ thá»ƒ sá»­ dá»¥ng OWASP ZAP Ä‘á»ƒ quÃ©t á»©ng dá»¥ng lab do nhÃ³m sá»Ÿ há»¯u, káº¿t há»£p kiá»ƒm thá»­ thá»§ cÃ´ng vÃ  automated integration tests.

### Nghiá»‡m thu tuáº§n 9

- Python tráº£ káº¿t quáº£ Normal/Anomaly.
- Web B hiá»ƒn thá»‹ cáº£nh bÃ¡o tá»« Python.
- CÃ³ Confusion Matrix vÃ  cÃ¡c chá»‰ sá»‘ Ä‘o Ä‘Æ°á»£c trÃªn dá»¯ liá»‡u kiá»ƒm thá»­.
- Bá»™ test báº£o máº­t Ä‘áº¡t tiÃªu chÃ­ Ä‘Ã£ Ä‘á»‹nh trÆ°á»›c.
- KhÃ´ng cÃ³ trÆ°á»ng há»£p truy cáº­p trÃ¡i phÃ©p Ä‘Æ°á»£c cho phÃ©p trong bá»™ test báº¯t buá»™c.
- CÃ³ báº±ng chá»©ng vá» giá»›i háº¡n cá»§a mÃ´ hÃ¬nh vÃ  cÃ¡c trÆ°á»ng há»£p cáº£nh bÃ¡o nháº§m.

## 8. Tuáº§n 10 â€“ TÃ­ch há»£p, hoÃ n thiá»‡n bÃ¡o cÃ¡o vÃ  chuáº©n bá»‹ báº£o vá»‡

Tuáº§n nghiá»‡m thu cuá»‘i cÃ¹ng

Má»¥c tiÃªu: ÄÃ³ng bÄƒng tÃ­nh nÄƒng, báº£o Ä‘áº£m toÃ n bá»™ há»‡ thá»‘ng cháº¡y Ä‘Æ°á»£c, cÃ³ tÃ i liá»‡u, báº±ng chá»©ng vÃ  demo á»•n Ä‘á»‹nh.

### Timeline tuáº§n 10

| Thá»i Ä‘iá»ƒm | CÃ´ng viá»‡c                                                       | Æ¯u tiÃªn |
| --------- | --------------------------------------------------------------- | ------- |
| NgÃ y 1    | Kiá»ƒm tra tÃ­ch há»£p Web A, Web B, Keycloak, LDAP, Audit vÃ  Python | P0      |
| NgÃ y 2    | Sá»­a lá»—i tÃ­ch há»£p, báº£o máº­t vÃ  quyá»n truy cáº­p                     | P0      |
| NgÃ y 3    | HoÃ n thiá»‡n UI/UX, tá»‘i Æ°u responsive, dá»¯ liá»‡u demo               | P0      |
| NgÃ y 4    | ÄÃ³ng bÄƒng tÃ­nh nÄƒng, backup vÃ  regression test                  | P0      |
| NgÃ y 5    | HoÃ n thÃ nh bÃ¡o cÃ¡o Word, sÆ¡ Ä‘á»“, káº¿t quáº£ thÃ­ nghiá»‡m              | P0      |
| NgÃ y 6    | Thiáº¿t káº¿ PowerPoint, quay video demo dá»± phÃ²ng                   | P0      |
| NgÃ y 7    | Diá»…n táº­p báº£o vá»‡, kiá»ƒm thá»­ láº§n cuá»‘i vÃ  bÃ n giao                  | P0      |

### CÃ¡c sáº£n pháº©m pháº£i bÃ n giao

| Sáº£n pháº©m            | YÃªu cáº§u                                             |
| ------------------- | --------------------------------------------------- |
| Source code         | Web A, Web B, Backend, Audit Service, Python        |
| Docker Compose      | TÃ¡i láº­p mÃ´i trÆ°á»ng thá»±c nghiá»‡m                      |
| Keycloak Config     | Realm, Client, Role, Flow, MFA                      |
| LDAP Config         | Cáº¥u hÃ¬nh Federation, Group Mapper                   |
| Database            | Schema, migration, dá»¯ liá»‡u demo, hÆ°á»›ng dáº«n sao lÆ°u  |
| Test Suite          | Ká»‹ch báº£n, dá»¯ liá»‡u, káº¿t quáº£ cháº¡y                     |
| Security Evidence   | áº¢nh, log, HTTP response, request ID                 |
| System Architecture | SÆ¡ Ä‘á»“ há»‡ thá»‘ng vÃ  trust boundary                    |
| Sequence Diagram    | OIDC, SSO, MFA, JCL, Audit Flow                     |
| BÃ¡o cÃ¡o Ä‘á»“ Ã¡n       | PhÃ¢n tÃ­ch, thiáº¿t káº¿, triá»ƒn khai, kiá»ƒm thá»­, Ä‘Ã¡nh giÃ¡ |
| PowerPoint          | Slide thuyáº¿t trÃ¬nh                                  |
| Demo Video          | Video dá»± phÃ²ng cÃ¡c chá»©c nÄƒng quan trá»ng             |

### Luá»“ng demo cuá»‘i cÃ¹ng nÃªn trÃ¬nh diá»…n

1

ÄÄƒng nháº­p Web A báº±ng tÃ i khoáº£n LDAP

2

HoÃ n thÃ nh xÃ¡c thá»±c MFA

3

Chuyá»ƒn sang Web B vÃ  chá»©ng minh SSO

4

Thá»­ truy cáº­p API trÃ¡i quyá»n â†’ HTTP 403

5

Äá»•i nhÃ³m/Role vÃ  kiá»ƒm tra quyá»n thay Ä‘á»•i

6

Thu há»“i phiÃªn hoáº·c vÃ´ hiá»‡u hÃ³a tÃ i khoáº£n

7

Xem Audit Log vÃ  cáº£nh bÃ¡o trÃªn Web B

8

Cháº¡y Python Detection vÃ  giáº£i thÃ­ch káº¿t quáº£

NguyÃªn táº¯c tuáº§n 10: KhÃ´ng bá»• sung cÃ´ng nghá»‡ lá»›n, khÃ´ng thay toÃ n bá»™ UI vÃ  khÃ´ng chuyá»ƒn cÆ¡ sá»Ÿ dá»¯ liá»‡u vÃ o sÃ¡t ngÃ y báº£o vá»‡. Chá»‰ sá»­a lá»—i, tá»‘i Æ°u, bá»• sung minh chá»©ng vÃ  hoÃ n thiá»‡n tÃ i liá»‡u.

## 9. PhÃ¢n chia cÃ´ng viá»‡c cho 2 thÃ nh viÃªn

Äá»ƒ hoÃ n thÃ nh trong 10 tuáº§n, má»—i ngÆ°á»i nÃªn phá»¥ trÃ¡ch má»™t nhÃ¡nh chÃ­nh nhÆ°ng cáº£ hai cÃ¹ng tham gia tÃ­ch há»£p, kiá»ƒm thá»­ vÃ  báº£o vá»‡.

| Tuáº§n | ThÃ nh viÃªn A â€“ IAM, Security, Infrastructure   | ThÃ nh viÃªn B â€“ Web, Database, UI/UX                 |
| ---- | ---------------------------------------------- | --------------------------------------------------- |
| 5    | MFA, token, session, API security              | Dashboard Web A/B, responsive, biá»ƒu Ä‘á»“              |
| 6    | LDAP/AD, Keycloak Federation, Group Mapping    | Giao diá»‡n quáº£n lÃ½ LDAP, hiá»ƒn thá»‹ tráº¡ng thÃ¡i Ä‘á»“ng bá»™ |
| 7    | JCL, phÃ¢n quyá»n, Ä‘á»“ng bá»™ tráº¡ng thÃ¡i            | Access Request, Approval, Governance UI             |
| 8    | Event Collector, báº£o máº­t log, retry            | Audit PostgreSQL, Security Analytics                |
| 9    | Security Test, threat scenarios, phÃ¢n tÃ­ch lá»—i | Python Detection, Metrics, Dashboard                |
| 10   | TÃ­ch há»£p, báº£o máº­t, kiá»ƒm thá»­ tá»•ng thá»ƒ           | BÃ¡o cÃ¡o, giao diá»‡n, slide, video demo               |

Hai thÃ nh viÃªn cÃ¹ng chá»‹u trÃ¡ch nhiá»‡m thiáº¿t káº¿ chÃ­nh sÃ¡ch quyá»n, giáº£i thÃ­ch kiáº¿n trÃºc vÃ  chá»©ng minh káº¿t quáº£.

## 10. Má»©c Ä‘á»™ Æ°u tiÃªn náº¿u khÃ´ng Ä‘á»§ thá»i gian

| Æ¯u tiÃªn       | Ná»™i dung                                                                                                          | Quyáº¿t Ä‘á»‹nh                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| P0 â€“ Báº¯t buá»™c | MFA hoÃ n chá»‰nh, RBAC/SSO á»•n Ä‘á»‹nh, LDAP Federation, JCL, Audit, Python baseline, kiá»ƒm thá»­                          | Pháº£i hoÃ n thÃ nh                |
| P1 â€“ NÃªn cÃ³   | Access Governance, dashboard nÃ¢ng cao, ML Detection, xá»­ lÃ½ log nÃ¢ng cao                                           | LÃ m sau P0                     |
| P2 â€“ Má»Ÿ rá»™ng  | Passkey, phÃª duyá»‡t nhiá»u cáº¥p, Active Directory tháº­t náº¿u Ä‘Ã£ cÃ³ OpenLDAP, HA, triá»ƒn khai Web B trÃªn mÃ¡y chá»§ thá»© hai | CÃ³ thá»ƒ Ä‘á»ƒ Ä‘á»‹nh hÆ°á»›ng tÆ°Æ¡ng lai |

Äá»‘i vá»›i tuáº§n 8, chá»‰ cáº§n chuyá»ƒn Audit Log sang PostgreSQL trÆ°á»›c; khÃ´ng báº¯t buá»™c chuyá»ƒn toÃ n bá»™ dá»¯ liá»‡u cháº¥m cÃ´ng vÃ  nghiá»‡p vá»¥ tá»« SQLite cÃ¹ng lÃºc. CÃ¡ch nÃ y háº¡n cháº¿ rá»§i ro.

Äá»‘i vá»›i tuáº§n 9, náº¿u thá»i gian ngáº¯n, Python Rule-based Detection cÃ³ dá»¯ liá»‡u Ä‘Ã¡nh giÃ¡ vÃ  cÃ¡c chá»‰ sá»‘ minh báº¡ch tá»‘t hÆ¡n má»™t mÃ´ hÃ¬nh Machine Learning chÆ°a Ä‘Æ°á»£c kiá»ƒm chá»©ng.

## 11. SÃ¡u má»‘c báº¯t buá»™c Ä‘á»ƒ kiá»ƒm soÃ¡t tiáº¿n Ä‘á»™

Theo dÃµi má»‘c nghiá»‡m thu

Chá»‰ Ä‘Ã¡nh dáº¥u khi Ä‘Ã£ kiá»ƒm thá»­ vÃ  lÆ°u minh chá»©ng

## 4/6 â€” tuáº§n 6, 7, 8, 9; tuáº§n 5 vÃ  10 cÃ²n nghiá»‡m thu ngoÃ i mÃ¡y hiá»‡n táº¡i

Tuáº§n 5 â€“ Authentication Hardened

MFA hoáº¡t Ä‘á»™ng; SSO, RBAC, token vÃ  session vÆ°á»£t qua cÃ¡c bÃ i kiá»ƒm thá»­.

Tuáº§n 6 â€“ Identity Federation

NgÆ°á»i dÃ¹ng LDAP Ä‘Äƒng nháº­p Ä‘Æ°á»£c vÃ  quyá»n pháº£n Ã¡nh Ä‘Ãºng Group Mapping.

Tuáº§n 7 â€“ Lifecycle Governance

Join/Change/Leave hoáº¡t Ä‘á»™ng Ä‘áº§u-cuá»‘i, cÃ³ tráº¡ng thÃ¡i Ä‘á»“ng bá»™ vÃ  lá»‹ch sá»­.

Tuáº§n 8 â€“ Centralized Monitoring

Sá»± kiá»‡n Keycloak/Web A/B ghi Ä‘Æ°á»£c vÃ o PostgreSQL vÃ  Ä‘Æ°á»£c tra cá»©u.

Tuáº§n 9 â€“ Detection & Security Validation

Python Detection hoáº¡t Ä‘á»™ng, cÃ³ chá»‰ sá»‘ vÃ  bÃ¡o cÃ¡o kiá»ƒm thá»­ báº£o máº­t.

Tuáº§n 10 â€“ Final Release

Demo cháº¡y á»•n Ä‘á»‹nh, bÃ¡o cÃ¡o/slide hoÃ n thÃ nh vÃ  cÃ³ báº£n backup.

&#x20;Sao chÃ©p báº£ng theo dÃµi

## 12. Káº¿t quáº£ cuá»‘i cÃ¹ng cá»§a Ä‘á»“ Ã¡n

Khi hoÃ n thÃ nh, báº¡n sáº½ cÃ³ má»™t ná»n táº£ng IAM mÃ´ phá»ng doanh nghiá»‡p vá»›i hai website hoáº¡t Ä‘á»™ng thá»±c táº¿, tÃ­ch há»£p Ä‘Äƒng nháº­p táº­p trung, xÃ¡c thá»±c Ä‘a yáº¿u tá»‘, quáº£n lÃ½ ngÆ°á»i dÃ¹ng vÃ  phÃ¢n quyá»n, liÃªn káº¿t thÆ° má»¥c LDAP/AD, kiá»ƒm soÃ¡t vÃ²ng Ä‘á»i tÃ i khoáº£n vÃ  há»‡ thá»‘ng giÃ¡m sÃ¡t truy cáº­p.

Vá» báº£o máº­t, há»‡ thá»‘ng sáº½ cÃ³ cÃ¡c cÆ¡ cháº¿ xÃ¡c thá»±c, phÃ¢n quyá»n phÃ­a backend, thu há»“i phiÃªn, quáº£n lÃ½ sá»± kiá»‡n, kiá»ƒm thá»­ truy cáº­p trÃ¡i phÃ©p vÃ  phÃ¡t hiá»‡n hoáº¡t Ä‘á»™ng báº¥t thÆ°á»ng. ÄÃ¢y lÃ  giáº£i phÃ¡p theo Ä‘á»‹nh hÆ°á»›ng Zero Trust, khÃ´ng Ä‘á»“ng nghÄ©a Ä‘Ã£ triá»ƒn khai Ä‘áº§y Ä‘á»§ má»i thÃ nh pháº§n kiáº¿n trÃºc Zero Trust cá»§a NIST.

Khuyáº¿n nghá»‹ quan trá»ng: Giá»¯ nguyÃªn cÃ¡c chá»©c nÄƒng Ä‘Ã£ lÃ m tá»‘t á»Ÿ tuáº§n 1â€“4. Vá»›i má»—i tÃ­nh nÄƒng má»›i, hÃ£y thá»±c hiá»‡n theo trÃ¬nh tá»± thiáº¿t káº¿ â†’ phÃ¡t triá»ƒn â†’ kiá»ƒm thá»­ â†’ lÆ°u evidence â†’ cáº­p nháº­t tÃ i liá»‡u, rá»“i má»›i chuyá»ƒn sang tÃ­nh nÄƒng tiáº¿p theo.

NhÆ° váº­y, Ä‘áº¿n cuá»‘i tuáº§n 10, nhÃ³m cÃ³ thá»ƒ trÃ¬nh diá»…n má»™t há»‡ thá»‘ng hoÃ n chá»‰nh vÃ  cÃ³ cÆ¡ sá»Ÿ ká»¹ thuáº­t Ä‘á»ƒ tráº£ lá»i cÃ¡c cÃ¢u há»i vá» IAM, SSO, LDAP, MFA, RBAC, Zero Trust vÃ  giÃ¡m sÃ¡t an toÃ n thÃ´ng tin.
