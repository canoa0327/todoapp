var router = require("express").Router();

function loginCheck(req, res, next) {
  if (req.user) {
    next();
  } else {
    res.send("로그인을 먼저 해주세요.");
  }
}

router.use(loginCheck); // 모든 URL에 미들웨어 적용시키기

router.get("/shirts", function (req, res) {
  res.send("셔츠 파는 페이지입니다.");
});

router.get("/pants", function (req, res) {
  res.send("바지 파는 페이지입니다.");
});

module.exports = router;
