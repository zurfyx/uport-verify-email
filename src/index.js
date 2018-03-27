import * as Isemail from 'isemail'
import * as qr from 'qr-image'
import * as nodemailer from 'nodemailer'

const DEFAULT_CONFIRM_SUBJECT = 'uPort Email Confirmation'
const DEFAULT_RECEIVE_SUBJECT = 'uPort Email Attestation'
const DEFAULT_TEMPLATE = qr => `<div><img src="${qr}"></img></div>`

const throwIfMissing = x => {
    throw new Error(`Missing parameter '${x}'`)
}

class EmailVerifier {

    /**
     * @callback template
     * @param {string} QR - QR code to embed in the template
     */

    /**
     * Instantiates a new Email Verifier object.
     * 
     * @constructor
     * 
     * @param   {Object}        settings - settings
     * @param   {string}        settings.callbackUrl - endpoint to call when user scans email verification QR
     * @param   {string}        settings.user - sender email address
     * @param   {string}        settings.pass - sender email password
     * @param   {string}        settings.host - mail server host name
     * @param   {number}        settings.port - mail server port number
     * @param   {boolean}       [settings.secure=false] - TLS flag
     * @param   {string}        [settings.confirmSubject] - confirmation email subject
     * @param   {string}        [settings.receiveSubject] - receive attestation email subject
     * @param   {template}      [settings.confirmTemplate] - confirmation email template
     * @param   {template}      [settings.receiveTemplate] - receive attestation email template
     * @param   {Object}        [settings.customRequestParams] - custom params for credentials.createRequest()
     * @param   {Credentials}   settings.credentials - uPort Credentials object
     */
    constructor ({
        callbackUrl = throwIfMissing`callbackUrl`,
        user = throwIfMissing`user`,
        pass = throwIfMissing`pass`,
        host = throwIfMissing`host`,
        port = throwIfMissing`port`,
        secure = false,
        from = '"Admin" <foo@example.com>',
        confirmSubject = DEFAULT_CONFIRM_SUBJECT,
        receiveSubject = DEFAULT_RECEIVE_SUBJECT,
        confirmTemplate = DEFAULT_TEMPLATE,
        receiveTemplate = DEFAULT_TEMPLATE,
        customRequestParams = {},
        credentials = throwIfMissing`credentials`,
    } = {}) {
        this.callbackUrl = callbackUrl
        // this.user = user
        // this.pass = pass
        // this.host = host
        // this.port = port
        // this.secure = secure
        this.from = from
        this.confirmSubject = confirmSubject
        this.receiveSubject = receiveSubject
        this.confirmTemplate = confirmTemplate
        this.receiveTemplate = receiveTemplate
        this.customRequestParams = customRequestParams
        this.credentials = credentials
        // this.transporter = nodemailer.createTransport({
        //     host,
        //     port,
        //     secure,
        //     auth: {
        //         user,
        //         pass,
        //     }
        // })
        this.transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user,
                pass,
            },
        })
    }

    /**
     * Generates a selective disclosure request and sends an email containing the request QR.
     * 
     * @param {string} email - email address to send selective disclosure QR to
     * @param {string} [callbackUrl=this.callbackUrl] - endpoint to call when user scans email verification QR
     * @return {string} selective disclosure request token
     */
    receiveEmail (email = throwIfMissing`email`, callbackUrl = this.callbackUrl) {
        if (!Isemail.validate(email)) throw new Error('invalid email format')

        // add email as callbackUrl param
        const callbackUrlWithEmail = `${callbackUrl}?email=${email}`

        // create selective disclosure JWT
        return this.credentials.createRequest({
            ...this.customRequestParams,
            callbackUrl: callbackUrlWithEmail,
            notifications: true,
        }).then(requestToken => {
            // create uPort request URL from JWT
            const requestUri = `me.uport:me?requestToken=${requestToken}`
            // create QR from request URL
            // const requestQrData = qr.imageSync(requestUri, { type: 'png' }).toString('base64')
            // const requestQrUri = `data:image/png;charset=utf-8;base64, ${requestQrData}`
            const requestQrData = qr.image(requestUri, { type: 'png' })
            requestQrData
                .pipe(require('fs').createWriteStream('QR.png'))
                .on('finish', () => {
                    // place QR in email template
                    const emailHtml = this.confirmTemplate('cid:unique@cid')
                    // send email
                    const emailOptions = {
                        from: this.from,
                        to: email,
                        subject: this.confirmSubject,
                        html: emailHtml,
                        attachments: [{
                            filename: 'QR.png',
                            path: './QR.png',
                            cid: 'unique@cid',
                        }],
                    }
                    this.transporter.sendMail(emailOptions, (error, info) => {
                        if (error) return console.log(error)
                        console.log(info)
                    })
                })
            return requestToken
        })
    }

    /**
     * Signs a claim attesting ownership of the email address to the uPort identity that
     * sent the access token.  Sends the attestation via push notification and email.
     * 
     * @param {string} accessToken - access token sent by uPort mobile in response to selective disclosure request
     * @param {Object} [settings={sendPush:true, sendEmail: false}] - options to send email attestation
     * @param {boolean} settings.sendPush - flag to send email attestation via push notification
     * @param {boolean} settings.sendEmail - flag to send email attestation via email containing QR code
     */
    verify (accessToken, settings = {sendPush: true, sendEmail: true}) {
        return { accessToken }
    }
}

export default EmailVerifier