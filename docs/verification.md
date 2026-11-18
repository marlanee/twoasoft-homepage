# 검증 기록

2026-11-17 KST 기준입니다. 1~4절은 **명령 출력**(nslookup, curl, openssl)이고, 5절은 실제 브라우저로 **화면을 확인한 결과**입니다. 인증서 검증을 끈 테스트는 없습니다.
초기 검증은 22:42, DNS 위임·TLS 재검증과 메일 관련 이름 대조는 22:48에 했습니다.

## 1. DNS 위임

```text
$ nslookup -type=NS twoasoft.co.kr b.dns.kr     # .kr 레지스트리
twoasoft.co.kr  nameserver = meg.ns.cloudflare.com
twoasoft.co.kr  nameserver = uriah.ns.cloudflare.com
```
`c.dns.kr`, `d.dns.kr`, `8.8.8.8`, `1.1.1.1`도 같은 결과였습니다. 레지스트리에 DS 레코드는 없습니다.

## 2. 웹 응답 매트릭스 (22:42, curl)

| 요청 | 응답 | 최종 |
|---|---|---|
| `http://twoasoft.co.kr/` | 301 → `https://twoasoft.co.kr/` | 200 |
| `https://twoasoft.co.kr/` | **200** | 200 |
| `http://www.twoasoft.co.kr/` | 301 → `https://twoasoft.co.kr/` | 200 (리디렉트 1회, 루프 없음) |
| `https://www.twoasoft.co.kr/` | 301 → `https://twoasoft.co.kr/` | 200 |
| `https://www.twoasoft.co.kr/robots.txt?t6=1` | 301 → `https://twoasoft.co.kr/robots.txt?t6=1` | 200 (경로·쿼리 보존) |
| `https://twoasoft.co.kr/t6-domain-missing` | **404** | 커스텀 404 페이지 |
| `https://twoasoft.twoasoft-homepage.workers.dev/` | 200 + `x-robots-tag: noindex` | – |

운영 주소 응답 헤더(발췌):

```text
HTTP/1.1 200 OK
Strict-Transport-Security: max-age=15552000
content-security-policy: default-src 'none'; script-src 'self' 'sha256-…'; …; frame-ancestors 'none'
x-content-type-options: nosniff
```

`canonical`·`og:url` = `https://twoasoft.co.kr/`이고, 운영 주소에는 `noindex`가 없습니다.

## 3. 인증서 (22:48 재검증, openssl)

```text
$ openssl s_client -connect 104.21.19.139:443 -servername www.twoasoft.co.kr \
    -verify_hostname www.twoasoft.co.kr -verify_return_error
subject=CN=twoasoft.co.kr
issuer=C=US, O=Google Trust Services, CN=WE1
Verification: OK
Verify return code: 0 (ok)
```

- SAN: `twoasoft.co.kr`, `www.twoasoft.co.kr`, `*.www.twoasoft.co.kr`
- 유효기간: 2026-11-17 ~ 2027-02-15 (Cloudflare가 자동 갱신)
- 엣지 IP 두 개(104.21.19.139, 172.67.186.112) 모두 검증 OK

## 4. 메일 레코드 보존

Cloudflare 권한 서버(`meg`), 8.8.8.8, 1.1.1.1 세 곳에서 같은 결과였습니다.

| 질의 | 결과 | 전환 전과 비교 |
|---|---|---|
| `twoasoft.co.kr MX` | 10 rmw-002.fmcity.com | 동일 |
| `twoasoft.co.kr TXT` | `v=spf1 ip4:211.34.104.37 ~all` | 동일 |
| `mail.` / `webmail.` / `smtp.` / `ftp.` / 임의 이름 `A` | 112.175.85.242 | 동일 |
| `mail.twoasoft.co.kr MX` | 10 rmw-002.fmcity.com | 동일(와일드카드 재현) |
| `_dmarc.`, `default._domainkey. TXT` | SPF 문자열 | 동일(옛 존도 와일드카드로 같은 값 응답) |
| `_autodiscover._tcp SRV` | 응답 없음(NODATA) | 동일 |

**검증하지 못한 것:** 실제 메일 송수신 테스트는 하지 못했습니다. 사서함 사용 여부를 확인할 수 없었고, DNS가 보존됐다는 것까지만 확인했습니다.

## 5. 브라우저 (화면 확인)

- Chrome에서 `http://www.twoasoft.co.kr/`를 입력하면 주소창이 `https://twoasoft.co.kr/`로 바뀝니다.
- 로고(SVG), 폰트, Google Maps가 정상 표시됐고 콘솔 오류와 CSP 위반은 없었습니다.

## 6. 운영 중 변경의 배포 검증 절차

콘텐츠를 바꿀 때마다 아래 순서를 지켰습니다.

1. 로컬 미리보기에서 확인: 1280px·375px 폭, `scrollWidth`로 가로 넘침 확인, 상호작용(지도 전환 등) 클릭 테스트
2. `wrangler deploy`
3. 운영 주소에서 새 문자열·ETag가 나올 때까지 확인(엣지 반영에 1~3분 걸린 사례 있음)
4. 실제 브라우저에서 강력 새로고침 후 화면 확인
