const Parser = require("rss-parser")
const dayjs = require("dayjs")
const nodeMailer = require("nodemailer")
require("dotenv").config()
var customParseFormat = require("dayjs/plugin/customParseFormat")
dayjs.extend(customParseFormat)

let parser = new Parser()

const settoriInteressanti = [
    "Ferroviario",
    "Generale",
    "Intersettoriale",
    "Trasporto pubblico locale",
]
const rilevanzeInteressanti = ["Nazionale", "Interregionale", "Da definire"]
const regioniInteressanti = [
    "Italia",
    "Lombardia",
    "Veneto",
    "Trentino-Alto Adige",
]
const provincieInteressanti = ["Tutte", "Milano", "Trento", "Verona"]
const ALERT_DAYS = 7

function sendEmail(
    from,
    to,
    subject,
    html,
    text,
    smtpConfig = {
        host: "smtp.sendgrid.net",
        port: 465,
        secure: true, //true for 465 port, false for other ports
        tls: { rejectUnauthorized: true },
        auth: {
            user: "apikey",
            pass: process.env.SENDGRID_API_KEY,
        },
    }
) {
    const transporter = nodeMailer.createTransport(smtpConfig)
    const mailOptions = {
        from,
        to: to.join(", "),
        subject,
        text,
        html,
    }

    transporter.sendMail(mailOptions, console.log)
}

async function main() {
    console.log("Fetching data")
    let feed = await parser.parseURL(
        "http://scioperi.mit.gov.it/mit2/public/scioperi/rss"
    )

    console.log("Parsing data")
    let parsedItems = feed.items
        .map((item) => {
            const lines = item.contentSnippet.split("\n")
            const data = {}

            for (let line of lines) {
                const blocks = line.split(":")
                const key = blocks[0].trim()
                const value = blocks.slice(1).join(":").trim()
                data[key] = value
            }

            const lines2 = item.title.split(" - ")
            for (let line of lines2) {
                const blocks = line.split(":")
                const key = blocks[0].trim()
                const value = blocks.slice(1).join(":").trim()
                data[key] = value
            }

            data.source = item
            return data
        })
        .filter((item) => settoriInteressanti.indexOf(item.Settore) !== -1)
        .filter(
            (item) =>
                rilevanzeInteressanti.indexOf(item.Rilevanza) !== -1 ||
                (regioniInteressanti.indexOf(item.Regione) !== -1 &&
                    provincieInteressanti.indexOf(item.Provincia) !== -1)
        )
        .map((item) => ({
            ...item,
            diff: dayjs(item["Data inizio"], "DD/MM/YYYY").diff(dayjs()),
            diffRicezione: dayjs().diff(
                dayjs(item["Data ricezione"], "DD/MM/YYYY")
            ),
        }))
        .filter(
            (item) =>
                item.diff < (ALERT_DAYS + 0.5) * 24 * 3600 * 1000 &&
                (item.diff > (ALERT_DAYS - 0.5) * 24 * 3600 * 1000 ||
                    item.diffRicezione < 0.5 * 24 * 3600 * 1000)
        )

    if (parsedItems.length > 0) {
        console.log("Sending email")

        let emailHTML = "Sono indetti i seguenti scioperi:<br/><br/>"
        for (let item of parsedItems) {
            emailHTML += item.source.content + "<br/><br/>"
        }
        emailHTML += `Per altre informazioni clicca <a href="http://scioperi.mit.gov.it/mit2/public/scioperi">qui</a>`

        sendEmail(
            "scioperi@baida.dev",
            [
                "99.zanin@gmail.com",
                "sofiacozzaglio@hotmail.com",
                "nemagleba@gmail.com",
            ],
            "Allerta Sciopero",
            emailHTML,
            "Sono indetti i seguenti scioperi"
        )
    } else {
        console.log("No email to send")
    }
}

main()
