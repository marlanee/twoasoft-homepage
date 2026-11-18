# HTTPS·도메인 이전 런북

`twoasoft.co.kr`을 리셀러 호스팅의 HTTP 사이트에서 Cloudflare Workers 기반 HTTPS 사이트로 옮긴 절차와 판단 근거를 정리했습니다.
시각은 모두 KST입니다. 공개 DNS로 누구나 조회할 수 있는 정보만 담았으며, 계정 ID·자격증명·업체명은 뺐습니다.

## 0. 출발점

| 항목 | 상태 |
|---|---|
| 등록 | `.kr` 도메인. 등록대행사 계정은 기존 웹 에이전시(리셀러)가 보유 |
| 위임 | 리셀러 호스팅의 네임서버 4대 |
| 웹 | 공유 호스팅 nginx + PHP CMS. `HTTP 200`, `HTTPS` → TLS 핸드셰이크 실패 |
| 메일 | MX `10 rmw-002.fmcity.com`, SPF `v=spf1 ip4:211.34.104.37 ~all` |
| 우리가 가진 권한 | 도메인·DNS 관리 권한 없음(웹 호스팅 접근만 일부 보유) |

## 1. DNS 원장 만들기 (2026-11-16)

존 파일을 받을 수 없어서 **4대 권한 서버에 직접 질의**해 원장을 만들었습니다(SOA serial `20201119`, TTL 1800).

| 이름 | 타입 | 값 |
|---|---|---|
| `@` | A | 112.175.85.242 |
| `www` | CNAME | `@` |
| `*` | CNAME | `@` |
| `@` | MX | 10 rmw-002.fmcity.com |
| `@` | TXT | `v=spf1 ip4:211.34.104.37 ~all` |
| `ns`, `ns1`~`ns3` | A | (네임서버 글루용 A 4개) |
| DS | – | 없음(레지스트리 조회) |
| CAA | – | 조회 도구 미지원으로 미확인 |

**발견:** `mail`, `webmail`, `smtp`, `_dmarc`, `default._domainkey`, 임의 문자열, 다단계 이름까지 전부 `* CNAME @`로 합성된 응답이었습니다.
그래서 `_dmarc.twoasoft.co.kr TXT`를 조회하면 DMARC가 아니라 **apex의 SPF 문자열**이 나왔습니다. 조회한 이름들에서는 유효한 DKIM·DMARC·SRV 레코드를 확인하지 못했습니다(존 파일을 받지 못해 전체 존은 미확보).

## 2. DNS 권한 없이 가능한가? — 대안 검토

| 대안 | 판정 | 이유 |
|---|---|---|
| 옛 서버에 리디렉트 파일 업로드 | 목표 미달 | HTTP→새 사이트 이동은 가능하지만 `https://twoasoft.co.kr` 자체는 여전히 TLS 실패 |
| 옛 서버에 인증서 설치 | 조건부 | 공유 호스팅 nginx·인증서 설치 권한이 없어 호스팅 업체의 SSL 설치가 필요 |
| Cloudflare Partial(CNAME) setup | 조건부 | Business 이상 플랜 + 기존 권한 DNS에 CNAME을 넣을 권한(업체 협조) 필요 |
| Cloudflare for SaaS | 조건부 | Free로 쓸 수 있지만 기존 DNS에 CNAME이 필요(업체 협조). A 레코드로 apex를 붙이는 Apex Proxying은 Enterprise 기능 |
| 다른 정적 호스팅으로 옮기고 A 레코드만 변경 | 조건부 | 기존 DNS 수정이 필요(업체 협조) |
| 등록대행사 **관리 계정 변경** 절차(사업자등록증 등 제출) | 가능 | 시간이 걸리고 서류가 필요 |
| KISA 인증코드로 등록대행사 이전 | 조건부 | 등록 연락처(휴대폰·이메일)로 인증할 수 있어야 함 |
| 리셀러에게 **네임서버 변경 요청** | **가능(채택)** | 한 번의 요청으로 끝나고, 이후 관리권이 Cloudflare로 넘어옴 |

결론: 대부분이 업체 협조를 전제로 한 조건부 대안이었습니다. 한 번의 요청으로 DNS 관리권까지 가져올 수 있는 **네임서버 변경을 채택**했습니다. 요청 문안(바꿀 NS 2개, 지울 NS 4개, 메일 영향 없음 안내)을 작성해 리셀러에 의뢰했습니다.

## 3. Cloudflare 존을 "옛 존과 동일하게" 준비 (전환 전)

Free 플랜으로 존을 추가하고, 배정 네임서버 `meg.ns.cloudflare.com`, `uriah.ns.cloudflare.com`를 받았습니다. 레코드는 모두 **DNS only**로 두었습니다.

| 이름 | 타입 | 값 | 프록시 |
|---|---|---|---|
| `@` | A | 112.175.85.242 | DNS only |
| `www` | CNAME | `twoasoft.co.kr` | DNS only |
| `*` | **A** | 112.175.85.242 | DNS only |
| `*` | **MX** | 10 rmw-002.fmcity.com | – |
| `*` | **TXT** | `v=spf1 ip4:211.34.104.37 ~all` | – |
| `@` | MX / TXT | 원장과 동일 | – |
| `ns`, `ns1`~`ns3` | A | 원장과 동일 | DNS only |

**판단:** 처음 지시서(TASK PACKET)는 메일 관련 호스트를 개별 A 레코드로 만들라고 했습니다. 하지만 원장에서 이 이름들이 모두 와일드카드 합성이라는 것이 확인됐습니다. 그래서 개별 나열 대신 `*` A/MX/TXT로 **와일드카드 CNAME이 돌려주던 응답을 그대로 재현**했습니다. 이 편차는 결과 보고에 명시했고 지휘자(GPT)의 승인을 받았습니다.

**검증:** Cloudflare 권한 서버 두 대에 직접 질의해, 원장에 있는 이름과 무작위 서브도메인의 A/MX/TXT **최종 값**이 옛 서버와 같은지 확인했습니다. CNAME 체인 같은 응답 구조나 조회하지 않은 이름까지 같다고는 확정할 수 없지만, 네임서버 변경으로 웹·메일 목적지가 바뀌지 않는 상태를 만들었습니다.

## 4. 네임서버 변경과 활성화 (2026-11-17)

| 시각 | 확인 |
|---|---|
| 22:37 | `.kr` 레지스트리(b/c/d.dns.kr), 8.8.8.8, 1.1.1.1 모두 NS = `meg`/`uriah.ns.cloudflare.com` |
| 22:37 | Cloudflare 존 **Active** |
| 22:37 | Universal SSL `*.twoasoft.co.kr, twoasoft.co.kr` **Active** (Google Trust Services, 2027-02-15 만료) |

DNSSEC은 쓰지 않았습니다(DS 없음). 따라서 서명 체인 불일치로 인한 `SERVFAIL` 위험도 없었습니다.

## 5. 컷오버 (22:38–22:42)

1. `wrangler.jsonc`에 Custom Domain 2개를 추가하고 `workers_dev: true`를 명시했습니다(미리보기 주소 유지).
   ```json
   "routes": [
     { "pattern": "twoasoft.co.kr", "custom_domain": true },
     { "pattern": "www.twoasoft.co.kr", "custom_domain": true }
   ]
   ```
2. `wrangler deploy --dry-run`을 실행하고(exit 0), 직전 배포 버전 ID를 기록했습니다(롤백 지점).
3. 충돌하는 웹 레코드 **2개만** 삭제했습니다: `@ A 112.175.85.242`, `www CNAME`. 삭제 확인 대화상자에서 이름·타입·값을 대조했습니다.
4. 즉시 `wrangler deploy`를 실행했습니다(exit 0). 출력은 `twoasoft.co.kr (custom domain)`, `www.twoasoft.co.kr (custom domain)`. 레코드 삭제부터 배포 완료까지 **약 1분**이었습니다(실제 서비스 중단 시간은 미측정).
5. SSL/TLS 모드를 Full → **Full (strict)** 로 바꿨습니다.
6. **Always Use HTTPS**를 켰습니다. 프록시를 거치는 트래픽에만 적용되므로, DNS only인 메일·와일드카드 호스트는 영향을 받지 않습니다.
7. Single Redirect `www-to-apex`를 추가했습니다.
   - 조건: `(http.host eq "www.twoasoft.co.kr")`
   - 대상: `concat("https://twoasoft.co.kr", http.request.uri.path)`, 301, Preserve query string

와일드카드 `*` A/MX/TXT는 apex를 따라가지 않는 독립 레코드라서, apex가 Worker로 바뀐 뒤에도 메일 관련 이름은 기존 값을 유지합니다.

## 6. 위험과 롤백

| 위험 | 대비 |
|---|---|
| 메일 레코드 누락 | 원장 대비 MX·SPF·와일드카드 응답을 전환 전후로 비교함. 문제가 생기면 DNS only 레코드를 먼저 복구 |
| Custom Domain 연결 실패 | Custom Domain을 해제한 뒤 `@ A 112.175.85.242`, `www CNAME`을 DNS only로 재생성하는 절차를 미리 작성 |
| 새 배포 문제 | `wrangler rollback <직전 버전 ID>` |
| 리디렉트 루프 | 규칙 비활성화 후 두 호스트 재검증 |
| **HSTS** | 새 사이트가 `max-age=15552000`(180일)을 보냅니다. 옛 서버는 HTTPS가 안 되므로 DNS를 되돌려도 HSTS를 기억한 브라우저는 접속하지 못합니다. 그래서 `includeSubDomains`·`preload`를 빼고, 롤백은 **DNS 원복이 아니라 Worker 이전 버전 복구를 우선**하도록 했습니다. |
| 네임서버 전체 원복 | 리셀러 네임서버 4개가 계속 응답하는지 확인해 둠. 원복을 요청하면 그대로 돌아가는 상태 |

## 7. 남은 일
- 도메인 관리 계정을 회사 명의로 정리
- `.co.kr` 메일 실제 송수신 테스트(DNS 보존까지만 검증함)
- 옛 호스팅 해지는 범위 밖
