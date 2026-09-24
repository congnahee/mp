# 포인트 아레나 기능 모듈 구조

## 원칙

- 각 기능 모듈은 해당 기능의 데이터 변경, 화면 렌더링, 버튼 이벤트를 한 파일에서 관리합니다.
- `js/ui.js`는 기능을 직접 알지 않고 `AppFeatures`에 등록된 모듈을 순서대로 실행합니다.
- 공통 저장소는 `js/store.js`, 저장 방식은 `js/storage.js`, 공통 대화상자와 날짜 선택기는 `js/ui.js`가 담당합니다.
- 기존 기능을 수정할 때는 아래 표의 담당 모듈을 먼저 수정합니다.

## 기능별 담당 파일

| 기능 | 담당 파일 |
|---|---|
| 반·학생 등록, 명단 업로드, 학생 색상 | `js/modules/roster.js` |
| 팀 사용, 팀 등록, 학생 팀 배정 | `js/modules/team.js` |
| 기간 시작·마감·초기화 | `js/modules/period.js` |
| 대상 선택, 점수 입력, 정답·오답, 채점 이력 | `js/modules/scoreEngine.js` |
| 퀴즈 생성, 문제·정답·배점, 퀴즈 진행 | `js/modules/quiz.js` |
| 순위 계산 | `js/modules/ranking.js` |
| 선물 세트, 사다리, 1위 발표 | `js/modules/gift.js` |
| 기분 온도계 데이터와 화면 | `js/modules/mood.js` |
| 그래프 종류와 PRESENT 화면 | `js/render/graphRenderer.js` |
| 테마, 색상 선택, 백업·복원 | `js/modules/settings.js` |
| 서버 DB·Firebase 연결과 저장 | `js/modules/sync.js` |

## 모듈 등록 규칙

기능 파일 끝에서 다음 형식으로 등록합니다.

```js
AppFeatures.register('feature-name', {
  order: 100,
  init: FeatureModule.init,
  render: FeatureModule.render,
  onSettingsTab: FeatureModule.onSettingsTab
});
```

- `init`: 버튼 이벤트를 한 번 연결합니다.
- `render`: 데이터가 바뀔 때 해당 기능 화면만 다시 그립니다.
- `onSettingsTab`: 특정 설정 탭이 열릴 때 필요한 화면을 준비합니다.

기능 내부 수정은 해당 모듈 파일에서 처리합니다. 모든 기능에 공통으로 쓰이는 렌더 주기, 모달, 날짜 선택 동작만 `js/ui.js`에서 수정합니다.
