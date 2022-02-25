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
const rilevanzeInteressanti = ["Nazionale", "Interregionale", "Da definere"]
const regioniInteressanti = [
    "Italia",
    "Lombardia",
    "Piemonte",
    "Trentino-Alto Adige",
]
const provincieInteressanti = ["Tutte", "Milano", "Trento", "Torino"]
const ALERT_DAYS = -1

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
    let feed = await parser.parseURL(
        "http://scioperi.mit.gov.it/mit2/public/scioperi/rss"
    )

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
        }))
        .filter(
            (item) =>
                item.diff > (ALERT_DAYS - 0.5) * 24 * 3600 * 1000 &&
                item.diff < (ALERT_DAYS + 0.5) * 24 * 3600 * 1000
        )

    let emailHTML =
        "Tra una settimana sono indetti i seguenti scioperi:<br/><br/>"
    for (let item of parsedItems) {
        emailHTML += item.source.content + "<br/><br/>"
    }
    emailHTML += `Per altre informazioni clicca <a href="http://scioperi.mit.gov.it/mit2/public/scioperi">qui</a>`

    sendEmail(
        "scioperi@baida.dev",
        ["99.zanin@gmail.com"],
        "Allerta Sciopero",
        emailHTML,
        "Tra una settimana sono indetti i seguenti scioperi"
    )
}

main()
