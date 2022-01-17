const { App } = require("deta");
const { Deta } = require("deta");

const deta = Deta();
const express = require("express");

const categories = [
  "all",
  "business",
  "entertainment",
  "general",
  "health",
  "science",
  "sports",
  "technology",
];

const newsapi_url = "https://newsapi.org/v2/top-headlines";

const app = App(express());

// This how to connect to or create a database.
const db = deta.Base("newsDB"); // access your DB

async function getNews(category = null) {
  let fetchUrl = `${newsapi_url}?${
    process.env.COUNTRY_CODE ? "country=" + process.env.COUNTRY_CODE : ""
  }${category ? "&category=" + category : ""}&pageSize=100&apiKey=${
    process.env.NEWS_API_KEY
  }`;
  const res = await fetch(fetchUrl);
  const resData = await res.json();
  let insertData = {
    request_url: fetchUrl,
    key: category ? category : "all",
    updated_at: new Date(),
    body: resData.articles,
  };
  await db.put(insertData);
}

async function revalidate() {
  const now = new Date();

  //when db is empity, start fetching data
  let dbData = await db.get("all");
  if (!dbData || dbData == {}) {
    categories.forEach(async (category) => {
      if (category == "all") {
        await getNews();
      } else {
        await getNews(category);
      }
    });
    return true;
  }
  let lastUpdateTime = dbData.updated_at;

  let timedifferenceHours = Math.abs(now - lastUpdateTime) / 36e5;

  if (timedifferenceHours >= 3) {
    categories.forEach(async (category) => {
      if (category == "all") {
        await getNews();
      } else {
        await getNews(category);
      }
    });
    return true;
  } else {
    return false;
  }
}

app.get("/news", async (req, res) => {
  const { category } = req.query;
  if (category) {
    if (categories.includes(category)) {
      const resData = await db.get(category);
      res.json(resData.body);
    } else {
      res.status(404).json({ message: "invalid category!" });
    }
  } else {
    const resData = db.get("all");
    res.json(resData.body);
  }
  revalidate();
});
app.get("/", async (req, res) => {
  res.send("Hello from Deta!");
});

app.lib.cron((event) => {
  revalidate();
  return "Revalidating via Cron...";
});

app.on("listening", function () {
  // get fresh datas on server startup.
  revalidate();
  return "Startup fetch data...";
});

module.exports = app;
