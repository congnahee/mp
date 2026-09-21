"use strict";
/* ============================================================
   RANKING MODULE — pure function, no state of its own
============================================================ */
const RankingModule = {
  computeStudents(cid){
    const students = DB.students[cid]||[];
    const scores = currentScores(cid);
    const list = students.map(s=>({...s, score: scores[s.id]||0}));
    list.sort((a,b)=>b.score-a.score);
    let rank=0, lastScore=null;
    list.forEach((item,i)=>{
      if(item.score!==lastScore){ rank=i+1; lastScore=item.score; }
      item.rank=rank;
    });
    return list;
  },
  computeTeams(cid){
    const teams = DB.teams[cid]||[];
    const studentScores = currentScores(cid);
    const teamBonus = currentTeamScores(cid);
    const list = teams.map(t=>{
      const members = TeamModule.membersOf(cid, t.id);
      const memberSum = members.reduce((sum,m)=>sum+(studentScores[m.id]||0), 0);
      return {id:t.id, name:t.name, color:t.color, memberCount:members.length, score: memberSum + (teamBonus[t.id]||0)};
    });
    list.sort((a,b)=>b.score-a.score);
    let rank=0, lastScore=null;
    list.forEach((item,i)=>{
      if(item.score!==lastScore){ rank=i+1; lastScore=item.score; }
      item.rank=rank;
    });
    return list;
  },
  // 헤더의 학생별/팀별 보기 전환에 따라 그래프·랭킹이 참조하는 공용 진입점
  current(cid){
    return (DB.teamsEnabled[cid] && DB.viewMode[cid]==='team') ? RankingModule.computeTeams(cid) : RankingModule.computeStudents(cid);
  }
};
