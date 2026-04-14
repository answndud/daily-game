질문: codex, claude code를 이용해서 프로젝트 개발할 때 우선 해당 프로젝트에 사용할 skills, command, agents 등등의 설정을 초기에 잘 하는게 중요하잖아. 그래서 codex, claude code 등의 공식 개발 문서 뿐만 아니라 https://github.com/affaan-m/everything-claude-code 이런 유명한 repo들도 ai한테 읽어보고 내 프로젝트에 잘 맞을 것 같은 설정들 뽑아오라고 하고 싶은데, 더 확인할만한 레퍼런스 목록 작성해줘. 꾸준히 개발되고 있는 것들로.

대답:
아래처럼 보시면 됩니다. 기준은 **초기 설정에 직접 도움되는가**, **공식/준공식인가**, **지금도 살아 있는가**로 잡았습니다. 단순 “AI coding tool 소개”가 아니라, **skills / commands / hooks / agents / MCP / repo-local instruction** 설계에 실제로 연결되는 것만 우선 골랐습니다. ([OpenAI 개발자][1])

## 1) 최우선으로 읽을 공식 문서

### OpenAI Codex

1. **Custom instructions with AGENTS.md**
   Codex가 `AGENTS.md`를 어떻게 읽고, 전역 지침과 프로젝트별 지침을 어떻게 겹쳐 적용하는지 정리한 핵심 문서입니다. 프로젝트 시작 시 “무엇을 전역 규칙으로 둘지 / 무엇을 repo-local로 둘지”를 설계할 때 가장 먼저 볼 만합니다. ([OpenAI 개발자][1])

2. **Config basics / Advanced configuration / Configuration reference**
   `~/.codex/config.toml`, `.codex/config.toml`, profile, override 구조를 공식적으로 설명합니다. 팀 공용 설정과 개인 실험 설정을 분리하려면 필수입니다. ([OpenAI 개발자][2])

3. **Agent Skills**
   Codex에서 skill을 어떤 단위로 패키징하는지, 언제 skill로 분리하는 게 좋은지 감이 잡힙니다. 프로젝트별 반복 작업을 skill로 추출하는 설계의 기준점으로 좋습니다. ([OpenAI 개발자][3])

4. **MCP 문서**
   외부 도구 연결을 어디까지 repo 설정에 넣고 어디까지 사용자 로컬 설정에 둘지 판단할 때 중요합니다. 데이터베이스, 이슈 트래커, 문서 시스템을 에이전트에 붙일 계획이면 초기에 봐야 합니다. ([OpenAI 개발자][4])

5. **Subagents**
   작업을 언제 서브에이전트로 쪼갤지에 대한 공식 방향이 있습니다. 대형 리포, 멀티서비스, 테스트/리팩터/리서치 분업이 필요한 프로젝트에서 유용합니다. ([OpenAI 개발자][5])

6. **Codex Prompting Guide / long-horizon tasks / skills 운영 사례**
   단순 문법 문서보다 실전 운영 감각을 줍니다. 특히 장기 태스크, 반복 검증, repo-local skills를 어떻게 써야 하는지에 대한 운영 관점이 좋습니다. ([OpenAI 개발자][6])

### Anthropic Claude Code

1. **Claude Code settings**
   `~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json` 계층이 명확히 정리돼 있습니다. 팀 공유 설정과 개인 설정 분리의 기준 문서입니다. ([Claude API Docs][7])

2. **Extend Claude with skills**
   Claude Code에서 `SKILL.md` 기반으로 skill을 구성하는 공식 문서입니다. slash command와 skill의 경계, 재사용 가능한 workflow 단위를 잡는 데 직접적입니다. ([Claude API Docs][8])

3. **CLI reference + release notes**
   공식 기능이 빠르게 변하고 있어서, 블로그 글보다 release notes를 같이 봐야 합니다. 최근 릴리스에는 hooks 강화, MCP 제어, agent 관련 frontmatter, slash command 개선 같은 변화가 들어와 있습니다. ([Claude API Docs][9])

4. **MCP 문서**
   Claude Code를 외부 도구와 연결할 때의 공식 기준입니다. 툴 연결이 많은 팀일수록 “초기 세팅의 절반”이 MCP이기 때문에 중요합니다. ([Claude API Docs][10])

5. **Agent SDK overview / Python reference**
   Claude Code를 단순 CLI가 아니라 에이전트 런타임으로 다루려면 봐야 합니다. 사내 자동화, custom loop, hook 기반 보안 제어를 만들려면 이쪽이 필요합니다. ([Claude API Docs][11])

---

## 2) 공식 다음으로 볼 만한 “살아있는” 커뮤니티 레퍼런스

### 1. affaan-m / everything-claude-code

사용자가 이미 언급한 저장소인데, 계속 볼 가치가 있습니다. 최근에도 업데이트되고 있고, 단순 팁 모음이 아니라 **agents / skills / hooks / rules / MCP 구성**을 한 묶음으로 운영하는 레포입니다. 특히 메모리 지속화 훅, 세션 시작/종료 훅, 공용/언어별 rules 분리 방식은 “초기 템플릿”으로 참고하기 좋습니다. 다만 그대로 복붙하기보다, 필요한 부분만 잘라 쓰는 게 맞습니다. ([GitHub][12])

### 2. hesreallyhim / awesome-claude-code

현재 활발히 관리되는 Claude Code 리소스 허브로 보는 편이 맞습니다. maintainer가 이 레포를 자신이 적극 관리하는 버전이라고 명시했고, 최근에도 리소스 제출 이슈가 계속 들어오고 있습니다. 개별 저장소를 직접 찾기 전에 여기서 **skills / hooks / slash commands / orchestrators / apps** 카테고리를 훑는 게 효율적입니다. ([GitHub][13])

### 3. a-list-of-claude-code-agents

에이전트 오케스트레이션 쪽만 따로 보고 싶을 때 좋습니다. “Claude Code 위에 어떤 agent framework들이 올라가는지”를 찾기 쉬운 편입니다. skill/command 수준이 아니라, **multi-agent workflow**를 설계할 때 참고할 만한 인덱스입니다. ([GitHub][14])

### 4. agents-radar

특정 툴 자체보다는 **에이전트 CLI 생태계의 변화를 추적**하는 용도입니다. Claude Code, Codex, Gemini CLI, OpenCode류가 어디서 차별화되는지 지속적으로 읽기 좋습니다. 설정 철학 비교용으로 쓸 만합니다. ([GitHub][15])

---

## 3) Codex 쪽에서 특히 봐야 하는 “실전 레퍼런스”

### 1. openai/codex 레포 자체

문서만 보지 말고 **공식 레포의 `AGENTS.md`**를 직접 보는 게 좋습니다. 실제로 OpenAI 내부/공식 레포가 어떤 식으로 테스트, 스냅샷, 락파일, 변경 범위 규칙을 Codex에게 전달하는지 보여줍니다. “에이전트에게 어떤 수준으로 작업 규칙을 명시해야 하는가”의 좋은 샘플입니다. ([GitHub][16])

### 2. Codex Prompting Guide

문서 제목은 prompting이지만, 실제로는 **AGENTS.md 운용, 긴 작업 분해, 명시적 검증 단계 설계**에 가깝습니다. 프로젝트 bootstrap prompt를 설계할 때 바로 써먹을 내용이 많습니다. ([OpenAI 개발자][6])

### 3. OpenAI의 skills 운영 사례 글

“skills를 어떻게 repo 운영에 연결하는가”가 잘 나옵니다. 단순히 skill 정의법이 아니라, 반복 검증/릴리스 준비/리뷰 같은 공학적 워크플로를 skill화하는 사례라서 실용적입니다. ([OpenAI 개발자][17])

---

## 4) 꾸준히 확인할 만한 보조 레퍼런스

### Claude Code release notes

Claude Code는 기능 변화 속도가 빨라서, 예전 블로그 글 하나 붙잡고 세팅하면 금방 낡습니다. hooks, MCP, slash command, settings migration 같은 변화가 릴리스 노트에 직접 반영됩니다. ([Claude API Docs][18])

### Codex changelog

Codex도 마찬가지입니다. 특히 설정 파일, AGENTS.md 처리, 앱/CLI 동작 차이, feature maturity는 changelog를 주기적으로 봐야 합니다. ([OpenAI 개발자][19])

### Anthropic Prompting Best Practices

Claude Code 전용 문서는 아니지만, skill이나 command 설계의 근간이 되는 문서입니다. 특히 “도구 사용”, “에이전트 시스템”, “구조화된 지시” 측면에서 기본기가 좋습니다. ([Claude API Docs][20])

---

## 5) 실제로 추천하는 읽기 순서

가장 효율적인 순서는 이렇습니다.

**1단계: 공식 구조 파악**

* Codex: AGENTS.md, config, skills, MCP
* Claude Code: settings, skills, CLI reference, MCP ([OpenAI 개발자][1])

**2단계: 공식 레포/운영 사례 확인**

* openai/codex의 `AGENTS.md`
* OpenAI skills 운영 사례
* Claude release notes에서 최근 기능 변화 확인 ([GitHub][16])

**3단계: 커뮤니티 템플릿 수집**

* everything-claude-code
* awesome-claude-code
* 필요하면 a-list-of-claude-code-agents ([GitHub][12])

**4단계: 프로젝트 맞춤형으로 추출**

* 공통 규칙
* 언어/프레임워크별 skill
* 검증 command
* hook 보안 정책
* MCP 연결 목록
  이 다섯 축으로 정리하면 과적합을 줄일 수 있습니다.

---

## 6) 내 기준으로 뽑은 “레퍼런스 목록”

아래 정도면 충분히 좋은 스타팅 셋입니다.

### 공식

* OpenAI Codex: AGENTS.md guide
* OpenAI Codex: Config basics / Advanced / Reference
* OpenAI Codex: Agent Skills
* OpenAI Codex: MCP
* OpenAI Codex: Subagents
* OpenAI Codex Prompting Guide
* Anthropic Claude Code: Settings
* Anthropic Claude Code: Skills
* Anthropic Claude Code: CLI Reference
* Anthropic Claude Code: MCP
* Anthropic Claude Agent SDK docs
* Claude Code release notes / changelog ([OpenAI 개발자][1])

### 커뮤니티/실전

* affaan-m/everything-claude-code
* hesreallyhim/awesome-claude-code
* hesreallyhim/a-list-of-claude-code-agents
* agents-radar ([GitHub][12])

---

## 7) 한 가지 주의점

`everything-claude-code` 같은 레포는 매우 유용하지만, 보통 **“한 사람의 강한 운영 스타일”**이 반영되어 있습니다. 그래서 그대로 들여오면 과도한 rule, 불필요한 hook, 프로젝트와 안 맞는 의사결정 흐름이 같이 들어올 수 있습니다. 공식 문서를 기준축으로 두고, 커뮤니티 레포는 **패턴 추출용**으로 쓰는 게 안전합니다. Codex와 Claude Code 둘 다 공식적으로 프로젝트/사용자 레벨 지침 계층과 skills 구성을 제공하므로, 최종 설계는 그 구조 안에 맞추는 편이 유지보수성이 좋습니다. ([OpenAI 개발자][1])

원하면 다음 답변에서 바로 이어서,
**“내 프로젝트에 맞는 reference 조사 프롬프트 템플릿”**이랑
**“초기 `.codex/`, `.claude/`, `AGENTS.md`, `SKILL.md` 구조 추천안”**까지 정리해드리겠습니다.

[1]: https://developers.openai.com/codex/guides/agents-md/?utm_source=chatgpt.com "Custom instructions with AGENTS.md – Codex"
[2]: https://developers.openai.com/codex/config-basic/?utm_source=chatgpt.com "Config basics – Codex"
[3]: https://developers.openai.com/codex/skills/?utm_source=chatgpt.com "Agent Skills – Codex | OpenAI Developers"
[4]: https://developers.openai.com/codex/mcp/?utm_source=chatgpt.com "Model Context Protocol – Codex"
[5]: https://developers.openai.com/codex/subagents/?utm_source=chatgpt.com "Subagents – Codex"
[6]: https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide/?utm_source=chatgpt.com "Codex Prompting Guide"
[7]: https://docs.anthropic.com/en/docs/claude-code/settings?utm_source=chatgpt.com "Claude Code settings - Claude Code Docs"
[8]: https://docs.anthropic.com/en/docs/claude-code/skills?utm_source=chatgpt.com "Extend Claude with skills - Claude Code Docs"
[9]: https://docs.anthropic.com/en/docs/claude-code/cli-reference?utm_source=chatgpt.com "CLI reference - Claude Code Docs"
[10]: https://docs.anthropic.com/en/docs/claude-code/mcp?utm_source=chatgpt.com "Connect Claude Code to tools via MCP"
[11]: https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-overview?utm_source=chatgpt.com "Agent SDK overview - Claude API Docs"
[12]: https://github.com/affaan-m/everything-claude-code?utm_source=chatgpt.com "affaan-m/everything-claude-code: The agent harness ..."
[13]: https://github.com/hesreallyhim/awesome-claude-code/issues/521?utm_source=chatgpt.com "Welcome! This is Awesome Claude Code · Issue #521"
[14]: https://github.com/hesreallyhim/a-list-of-claude-code-agents?utm_source=chatgpt.com "hesreallyhim/a-list-of-claude-code-agents"
[15]: https://github.com/duanyytop/agents-radar/issues/353?utm_source=chatgpt.com "AI CLI Tools Digest 2026-04-01 · Issue #353"
[16]: https://github.com/openai/codex/blob/-/AGENTS.md?utm_source=chatgpt.com "AGENTS.md - openai/codex"
[17]: https://developers.openai.com/blog/skills-agents-sdk/?utm_source=chatgpt.com "Using skills to accelerate OSS maintenance"
[18]: https://docs.anthropic.com/en/release-notes/claude-code?utm_source=chatgpt.com "claude-code/CHANGELOG.md at main"
[19]: https://developers.openai.com/codex/changelog/?utm_source=chatgpt.com "Codex changelog"
[20]: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/be-clear-and-direct?utm_source=chatgpt.com "Prompting best practices - Claude API Docs"