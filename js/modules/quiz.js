"use strict";
/* ============================================================
   QUIZ MODULE — modes A/B/C. Only talks to ScoreEngine.
============================================================ */
const QuizModule = {
  create(cid, mode, title){
    ensureClassData(cid);
    const q = {id:uid(), mode, title: title||'퀴즈', questions:[], currentIndex:0, live:false};
    DB.quizzes[cid].push(q);
    return q;
  },
  addQuestion(quiz, text, answer, points){
    quiz.questions.push({id:uid(), text, answer:answer||'', points: points||10});
  },
  startLive(cid, quizId){
    DB.quizzes[cid].forEach(q=>q.live=false);
    if(quizId){
      const q = DB.quizzes[cid].find(x=>x.id===quizId);
      if(q){ q.live=true; q.currentIndex=0; }
    }
    DB.selection[cid].quizId = quizId;
    persistAndRender();
  },
  liveQuiz(cid){ return (DB.quizzes[cid]||[]).find(q=>q.live) || null; },
  nextQuestion(cid){
    const q = QuizModule.liveQuiz(cid);
    if(q && q.currentIndex < q.questions.length-1){ q.currentIndex++; persistAndRender(); }
  },
  prevQuestion(cid){
    const q = QuizModule.liveQuiz(cid);
    if(q && q.currentIndex>0){ q.currentIndex--; persistAndRender(); }
  }
};
