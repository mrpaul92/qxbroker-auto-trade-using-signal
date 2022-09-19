const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const moment = require("moment");
const cheerio = require("cheerio");
const delay = require("delay");
const chalk = require("chalk");
const readlineSync = require("readline-sync");
const nodeSchedule = require("node-schedule");
const dotenv = require("dotenv");
dotenv.config();
const log = console.log;

(async () => {
  const browser = await puppeteer.launch({ headless: false, args: [
      '--start-maximized',
    ], defaultViewport: null });
  const [page] = await browser.pages();
  await page.goto("https://qxbroker.com/en/sign-in");

  await page.type("input[name=email]", process.env.EMAIL);
  await page.type("input[name=password]", process.env.PASSWORD);
  await page.click("button[class=modal-sign__block-button]");
  await page.waitForNavigation();

  // check current page url
  const check_url = page.url();
  if (check_url === "https://qxbroker.com/en/trade" || check_url === "https://qxbroker.com/en/demo-trade") {
    log(chalk.green("Login Success without otp"));
  } else {
    const otp = readlineSync.question("Enter OTP: ");
    log(chalk.bgGreenBright("OTP entered: ", otp));
    if (!otp) {
      log(chalk.bgYellowBright("***** OTP is required *****"));
      await browser.close();
    }

    await page.type("input[name=code]", otp);
    await page.click("button[type=submit]");
    await page.waitForNavigation();
  }

  // successfully logged in
  process.env.mode === "live" ? await page.goto("https://qxbroker.com/en/trade") : await page.goto("https://qxbroker.com/en/demo-trade");

  // set the investment amount
  await page.waitForSelector("#root > div > div.page.app__page > main > div.page__sidebar > div.sidebar-section.sidebar-section--dark.sidebar-section--large > div > div.section-deal__form > div.section-deal__investment.section-deal__input-black > div > label > input");
  const investmentSelector = await page.$('#root > div > div.page.app__page > main > div.page__sidebar > div.sidebar-section.sidebar-section--dark.sidebar-section--large > div > div.section-deal__form > div.section-deal__investment.section-deal__input-black > div > label > input');
  await investmentSelector.click({ clickCount: 3 });
  await page.keyboard.type(Math.ceil(parseInt(process.env.AMOUNT)).toString())
  await delay(2000);


  // read text file for signal
  let signalDataFile = fs.readFileSync(path.join(__dirname, "signal.txt"), "utf8");
  let signalData = signalDataFile.split("\n");
  signalData = signalData.map((item) => {
    let data = item.split(" ");
    return  {
      time: data[0],
      pair: data[1],
      type: data[2] === "CALL" ? "BUY" : "SELL",
      completed: false,
    }
  });

  // every second check the signal
  setInterval(async () => {
    let currentTime = moment().format("HH:mm");
    let signal = signalData.find((item) => item.time == currentTime && item.completed === false);
    if (signal) {
        log(chalk.green("***** Signal found *****"));
        log(chalk.green("Signal time: ", signal.time));
        log(chalk.green("Signal type: ", signal.type));

        if(signal.type === "BUY") {
          await page.evaluate(() => document.querySelector("#root > div > div.page.app__page > main > div.page__sidebar > div.sidebar-section.sidebar-section--dark.sidebar-section--large > div > div.section-deal__put > div.section-deal__success > button > span").click());
        }else{
          await page.evaluate(() => document.querySelector("#root > div > div.page.app__page > main > div.page__sidebar > div.sidebar-section.sidebar-section--dark.sidebar-section--large > div > div.section-deal__put > div.section-deal__danger > button > span").click());
        }

        console.log(" ");


        // mark the signal as completed
      let findIndex = signalData.findIndex((item) => item.time == currentTime && item.completed === false);
      if(findIndex !== -1) {
        signalData[findIndex].completed = true;
      }
    }
  }, 500);
})();
