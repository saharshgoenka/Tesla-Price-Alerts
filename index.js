const puppeteer = require('puppeteer');
const fspromise = require('fs').promises;
require('dotenv').config();
const nodemailer = require('nodemailer');
const { exec } = require('child_process');
require('path');
const delay = ms => new Promise(res => setTimeout(res, ms));

const fs = require('fs');

const { writeFile } = require("fs");

(async () => {
    const currentDate = new Date().toISOString().split('T')[0].replace(/[^0-9]/g, '-');
    // const url = 'https://www.tesla.com/inventory/new/my?TRIM=LRAWD&arrangeby=plh&zip=94539&range=100';
    const url = 'https://www.tesla.com/inventory/new/my?TRIM=LRAWD&arrangeby=plh&zip=85281&range=100';
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36';

    let errorCount = 0;
    const startTime = Date.now();
    let lineNumber = 0;
    // const browser = await puppeteer.launch();
    const browser = await puppeteer.launch({ useHTTP2: false });

    const page = await browser.newPage();
    page.setUserAgent(ua);
    await page.setDefaultNavigationTimeout(0);
    let logContent = "";

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SENDER_EMAIL,
            pass: process.env.PASSWORD
        }
    });

    async function checkCheapestCar() {
        try {
            console.log("Loading Page...");
            await page.goto(url, { timeout: 60000 });

            await page.waitForSelector('.result-purchase-price.tds-text--h4', { timeout: 60000 });

            const carPrices = await page.$$eval('.result-purchase-price.tds-text--h4', (elements) => {
                return elements.map(element => parseInt(element.textContent.replace('$', '').replace(',', '')));
            });

            const cheapestPrice = Math.min(...carPrices);
            if (cheapestPrice < 45000) {
                const mailOptions = {
                    from: process.env.SENDER_EMAIL,
                    to: process.env.RECIPIENT_EMAIL,
                    subject: `Cheapest Tesla Car Price Alert: $${cheapestPrice}`,
                    text: `The cheapest Tesla car on the website is now priced at $${cheapestPrice}.`
                };

                await transporter.sendMail(mailOptions, function (error) {
                    if (error) {
                        console.log(error);
                    } else {
                        console.log('Email sent!\n');
                    }
                });
            }

            console.log("Page Loaded!");
        } catch (error) {
            console.error("Error occurred while checking car prices:", error);
            errorCount++;
        }
    }

    async function sendDailyReport() {
        try {
            const runTime = Date.now() - startTime;
            const runTimeMinutes = Math.floor(runTime / 60000);
            const runTimeSeconds = Math.floor((runTime % 60000) / 1000);

            const mailOptions = {
                from: process.env.SENDER_EMAIL,
                to: process.env.RECIPIENT_EMAIL,
                subject: `Daily Program Report (${currentDate})`,
                text: `
                    Program running stats:
                    - Total runtime: ${runTimeMinutes} minutes and ${runTimeSeconds} seconds
                    - Number of errors: ${errorCount}
                `
            };

            await transporter.sendMail(mailOptions, function (error) {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Daily report email sent!\n');
                }
            });
        } catch (error) {
            console.error("Error occurred while sending daily report:", error);
        }
    }

    await checkCheapestCar();

    // Run the weekly report task every Sunday at 12:00 AM
    const dailyReportTime = new Date();
    dailyReportTime.setHours(0, 0, 0, 0);

    // setInterval(sendDailyReport, 24 * 60 * 60 * 1000); // Run daily report every 24 hours
    setInterval(sendDailyReport, 6 * 60 * 60 * 1000);

    await browser.close();
})();