// server.js - Enhanced with Message Queue for WhatsApp Images
const express = require('express');
const cors = require('cors');
const wppconnect = require('@wppconnect-team/wppconnect');

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// --- Message Queue Implementation ---
class MessageQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.processingDelay = 2000; // 2 seconds between each message
    }

    async enqueue(message) {
        this.queue.push({
            ...message,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now()
        });
        console.log(`Message queued. Queue length: ${this.queue.length}`);
        
        if (!this.processing) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;
        console.log('Starting queue processing...');

        while (this.queue.length > 0) {
            const message = this.queue.shift();
            console.log(`Processing message ${message.id}. Remaining in queue: ${this.queue.length}`);

            try {
                // Process message with retry logic
                await this.processMessageWithRetry(message);
                
                // Wait before processing next message to avoid race conditions
                if (this.queue.length > 0) {
                    console.log(`Waiting ${this.processingDelay}ms before next message...`);
                    await this.delay(this.processingDelay);
                }
            } catch (error) {
                console.error(`Failed to process message ${message.id}:`, error);
                // You could implement a dead letter queue here for failed messages
            }
        }

        this.processing = false;
        console.log('Queue processing completed.');
    }

    async processMessageWithRetry(message, maxRetries = 3) {
        let attempts = 0;
        
        while (attempts < maxRetries) {
            try {
                await this.sendToN8N(message);
                console.log(`Message ${message.id} processed successfully on attempt ${attempts + 1}`);
                return;
            } catch (error) {
                attempts++;
                console.error(`Attempt ${attempts} failed for message ${message.id}:`, error.message);
                
                if (attempts < maxRetries) {
                    const delay = Math.pow(2, attempts) * 1000; // Exponential backoff
                    console.log(`Retrying in ${delay}ms...`);
                    await this.delay(delay);
                }
            }
        }
        
        throw new Error(`Failed to process message ${message.id} after ${maxRetries} attempts`);
    }

    async sendToN8N(message) {
        // Send to primary webhook URL only (remove duplicate processing)
        const primaryWebhookUrl = N8N_WEBHOOK_URLS[0]; // Use first URL as primary
        
        const response = await fetch(primaryWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        console.log(`Message ${message.id} successfully sent to N8N`);
        return response;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Method to get queue status
    getStatus() {
        return {
            queueLength: this.queue.length,
            processing: this.processing
        };
    }
}

// Initialize message queue
const messageQueue = new MessageQueue();

// --- N8N Webhook Configuration ---
const N8N_WEBHOOK_URLS = [
    process.env.N8N_WEBHOOK_URL_1 || 'https://agent.echowkidar.in/webhook/e77397ab-fe1b-407b-9afe-77edab1dd92d',
    // Keep backup URL for failover, but don't send duplicates
    // process.env.N8N_WEBHOOK_URL_2 || 'https://agent.echowkidar.in/webhook-test/e77397ab-fe1b-407b-9afe-77edab1dd92d'
];

console.log('Primary Webhook URL configured:', N8N_WEBHOOK_URLS[0]);

// --- WPPConnect Initialization ---
let client;
let qrCodeData = null;

async function initializeWPPConnect() {
    console.log('Attempting to initialize WPPConnect...');
    try {
        client = await wppconnect.create({
            session: 'n8n-whatsapp-bot',
            headless: true,
            useChrome: true,
            browserArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
            catchQR: (base64Qrimg, asciiQR, attempts, urlCode) => {
                console.log('QR Code received!');
                console.log('Scan this QR code with your WhatsApp app:');
                console.log(asciiQR);

                qrCodeData = {
                    base64: base64Qrimg,
                    ascii: asciiQR,
                    url: urlCode,
                    attempts: attempts
                };
            },
            statusFind: (statusSession, session) => {
                console.log('Session Status:', statusSession, 'Session Name:', session);
                if (statusSession === 'isLogged') {
                    console.log('WPPConnect client is now logged in!');
                    qrCodeData = null;
                }
            },
            logQR: true,
            autoClose: 60000,
            tokenStore: 'file',
            folderNameToken: './tokens',
        });

        console.log('WPPConnect client initialized.');

        // --- Enhanced Message Handler with Queue ---
        client.onMessage(async (message) => {
            console.log('Received message from WhatsApp:', message.from, message.body, 'Type:', message.type);

            // Ignore unwanted messages
            if (message.fromMe || message.isGroupMsg || message.type === 'protocol' || message.type === 'notification_code') {
                return;
            }

            let n8nPayload = {
                from: message.from,
                id: message.id,
                type: message.type,
                timestamp: message.timestamp,
                originalTimestamp: Date.now(), // Add processing timestamp
            };

            try {
                // Handle different message types
                if (message.type === 'chat' || message.type === 'ptt' || message.type === 'vcard' || message.type === 'location' || message.type === 'sticker') {
                    n8nPayload.body = message.body;
                    console.log('Processing non-media message');
                } else if (message.type === 'image' || message.type === 'video' || message.type === 'document' || message.type === 'audio') {
                    console.log(`Processing ${message.type} message. Attempting to download media...`);
                    
                    try {
                        const buffer = await client.decryptFile(message);
                        const base64Media = buffer.toString('base64');
                        
                        n8nPayload.mediaBase64 = base64Media;
                        n8nPayload.mediaMimeType = message.mimetype;
                        n8nPayload.fileName = message.filename || `media_file.${message.mimetype.split('/')[1] || 'dat'}`;
                        n8nPayload.caption = message.body || '';

                        console.log(`Media (${message.mimetype}) downloaded and prepared for queue`);
                    } catch (mediaError) {
                        console.error('Error downloading or processing media:', mediaError);
                        n8nPayload.body = message.body || 'Media download failed.';
                    }
                } else {
                    console.log(`Received unhandled message type: ${message.type}`);
                    n8nPayload.body = message.body || `Unhandled message type: ${message.type}`;
                }

                // Add to queue instead of sending immediately
                console.log('Adding message to processing queue...');
                await messageQueue.enqueue(n8nPayload);

            } catch (error) {
                console.error('Error preparing message for queue:', error);
            }
        });

    } catch (error) {
        console.error('Error initializing WPPConnect:', error);
        qrCodeData = null;
    }
}

// Initialize WPPConnect
initializeWPPConnect();

// --- API Endpoints ---

app.get('/api/qr-code', (req, res) => {
    if (qrCodeData) {
        res.json({ success: true, qrCode: qrCodeData });
    } else {
        res.status(202).json({ success: false, message: 'QR code not yet available or session not started.' });
    }
});

// New endpoint to check queue status
app.get('/api/queue-status', (req, res) => {
    const status = messageQueue.getStatus();
    res.json({
        success: true,
        ...status,
        message: `Queue has ${status.queueLength} messages. Processing: ${status.processing}`
    });
});

app.post('/api/send-message', async (req, res) => {
    const { to, message } = req.body;

    if (!to || !message) {
        return res.status(400).json({ success: false, message: 'Phone number and message are required.' });
    }

    if (!client || !(await client.isConnected())) {
        return res.status(401).json({ success: false, message: 'WPPConnect client not authenticated or not ready.' });
    }

    console.log(`Attempting to send message to ${to}: "${message}"`);
    try {
        const result = await client.sendText(to, message);
        console.log('Message sent result:', result);
        res.json({ success: true, message: 'Message sent successfully.', result: result });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, message: `Failed to send message: ${error.message}` });
    }
});

app.post('/api/send-media', async (req, res) => {
    const { to, filePath, caption } = req.body;

    if (!to || !filePath) {
        return res.status(400).json({ success: false, message: 'Phone number and file path are required.' });
    }

    if (!client || !(await client.isConnected())) {
        return res.status(401).json({ success: false, message: 'WPPConnect client not authenticated or not ready.' });
    }

    console.log(`Attempting to send media ${filePath} to ${to} with caption: "${caption || ''}"`);
    try {
        const result = await client.sendFile(to, filePath, 'media_file', caption);
        console.log('Media sent result:', result);
        res.json({ success: true, message: 'Media sent successfully.', result: result });
    } catch (error) {
        console.error('Error sending media:', error);
        res.status(500).json({ success: false, message: `Failed to send media: ${error.message}` });
    }
});

app.post('/api/n8n-reply', async (req, res) => {
    const { to, reply } = req.body;

    if (!to || !reply) {
        return res.status(400).json({ success: false, message: 'Recipient (to) and reply message are required.' });
    }

    if (!client || !(await client.isConnected())) {
        return res.status(401).json({ success: false, message: 'WPPConnect client not authenticated or not ready to send reply.' });
    }

    console.log(`Received AI reply from n8n for ${to}: "${reply}"`);
    try {
        const result = await client.sendText(to, reply);
        console.log('AI reply sent via WhatsApp:', result);
        res.json({ success: true, message: 'AI reply sent successfully via WhatsApp.', result: result });
    } catch (error) {
        console.error('Error sending AI reply via WhatsApp:', error);
        res.status(500).json({ success: false, message: `Failed to send AI reply via WhatsApp: ${error.message}` });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`WPPConnect Backend server listening at http://localhost:${port}`);
    console.log('--- IMPORTANT ---');
    console.log(`Primary N8N Webhook URL: ${N8N_WEBHOOK_URLS[0]}`);
    console.log(`Configure your n8n workflow to send AI replies to: http://localhost:${port}/api/n8n-reply`);
    console.log(`Check queue status at: http://localhost:${port}/api/queue-status`);
    console.log('Message queue initialized with 2-second processing delay.');
});