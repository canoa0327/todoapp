const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const methodOverride = require("method-override");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const { objectId } = require("mongodb");
require("dotenv").config();

app.use(
  session({ secret: "passcode", resave: true, saveUninitialized: false })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

var db;

const MongoClient = require("mongodb").MongoClient;
MongoClient.connect(process.env.DB_URL, function (error, client) {
  if (error) {
    return console.log("에러");
  }
  db = client.db("todoapp");
  app.listen(process.env.PORT, function () {
    console.log("listening on 8080");
  });
});

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

app.get("/write", function (req, res) {
  res.sendFile(__dirname + "/write.html");
});

app.get("/list", function (req, res) {
  db.collection("post")
    .find()
    .toArray(function (error, result) {
      res.render("list.ejs", { posts: result });
    });
});

app.get("/detail/:id", function (req, res) {
  db.collection("post").findOne(
    { _id: parseInt(req.params.id) },
    function (error, result) {
      res.render("detail.ejs", { posts: result });
    }
  );
});

app.get("/edit/:id", function (req, res) {
  db.collection("post").findOne(
    {
      _id: parseInt(req.params.id),
    },
    function (error, result) {
      res.render("edit.ejs", { post: result });
    }
  );
});

app.put("/edit", function (req, res) {
  db.collection("post").updateOne(
    { _id: parseInt(req.body.id) },
    {
      $set: {
        name: req.body.title,
        age: req.body.date,
      },
    },
    function (error, result) {
      res.redirect("/list");
    }
  );
});

app.get("/login", function (req, res) {
  res.render("login.ejs");
});

app.get("/mypage", loginCheck, function (req, res) {
  res.render("mypage.ejs", { user: req.user });
});

app.get("/search", (req, res) => {
  db.collection("post")
    .find({ $text: { $search: req.query.value } })
    .toArray((error, result) => {
      res.render("search.ejs", { search: result, value: req.query.value });
    });
});

function loginCheck(req, res, next) {
  if (req.user) {
    next();
  } else {
    res.send("로그인을 먼저 해주세요.");
  }
}

passport.use(
  new LocalStrategy(
    {
      usernameField: "id",
      passwordField: "pw",
      session: true,
      passReqToCallback: false,
    },
    function (username, password, done) {
      db.collection("login").findOne(
        { id: username },
        function (error, result) {
          if (error) return done(error);
          if (!result)
            return done(null, false, {
              message: "존재하지 않는 아이디입니다.",
            });
          if (password == result.pw) {
            return done(null, result);
          } else {
            return done(null, false, { message: "비밀번호가 다릅니다." });
          }
        }
      );
    }
  )
);

passport.serializeUser(function (user, done) {
  done(null, user.id);
});
passport.deserializeUser(function (id, done) {
  db.collection("login").findOne({ id: id }, function (error, result) {
    done(null, result);
  });
});

app.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/fail",
  }),
  function (req, res) {
    res.redirect("/");
  }
);

app.post("/register", function (req, res) {
  db.collection("login").insertOne(
    { id: req.body.id, pw: req.body.pw },
    function (error, result) {
      res.redirect("/");
    }
  );
});

app.post("/add", function (req, res) {
  db.collection("counter").findOne(
    { name: "countPost" },
    function (error, result) {
      var allCountPost = result.totalPost;

      db.collection("post").insertOne(
        {
          _id: allCountPost + 1,
          name: req.body.title,
          age: req.body.date,
          writer: req.user._id,
        },
        db
          .collection("counter")
          .updateOne(
            { name: "countPost" },
            { $inc: { totalPost: 1 } },
            function (error, result) {
              if (error) {
                return console.log("error");
              }
            }
          )
      );
    }
  );

  res.redirect("/list");
});

app.delete("/delete", function (req, res) {
  req.body._id = parseInt(req.body._id);
  let deleteData = { _id: req.body._id, writer: req.user._id };
  db.collection("post").deleteOne(deleteData, function (error, result) {
    if (error) {
      console.log(error);
    }
    console.log("삭제완료");
    res.status(200).send({ message: "삭제하였습니다." });
  });
});

app.post("/chatroom", loginCheck, function (req, res) {
  var data = {
    title: "",
    member: [objectId(req.body.toChat), req.user._id],
    data: new Date(),
  };
  db.collection("chatroom")
    .insertOne(data)
    .then(() => {});
});

app.get("/chat", loginCheck, function (req, res) {
  db.collection("chatroom")
    .find({ member: req.user._id })
    .toArray()
    .then((result) => {
      res.render("chat.ejs", { data: result });
    });
});

app.post("/message", loginCheck, function (req, res) {
  var data = {
    parent: req.body.parent,
    content: req.body.content,
    userid: req.user._id,
    date: new Date(),
  };
  db.collection("message")
    .insertOne(data)
    .then(() => {
      console.log("성공");
      res.send("DB저장성공");
    });
});

app.get("/message:id", loginCheck, function (req, res) {
  res.writeHead(200, {
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
  });

  db.collection("message")
    .find({ parent: req.params.id })
    .toArray()
    .then((result) => {
      res.write("event: test\n");
      res.write("data: " + JSON.stringify(result) + "\n\n");
    });

  const pipeline = [{ $match: { "fullDocument.parent": req.params.id } }];
  const collection = db.collection("message");
  const changeStrean = collection.watch(pipeline);
  changeStrean.on("change", (result) => {
    res.write("event: test\n");
    res.write("data: " + JSON.stringify([result.fullDocument]) + "\n\n");
  });
});

app.use("/shop", require("./routes/shop.js"));
app.use("/board", require("./routes/board.js"));
