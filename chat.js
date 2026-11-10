require('dotenv').config();
const express = require('express');
const hubspot = require('@hubspot/api-client');

const app = express();
app.use(express.json());

// Inicializa el cliente de HubSpot con tu Token de Aplicación Privada
const hubspotClient = new hubspot.Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

// Ruta Webhook donde tu canal de chat (WhatsApp, Web, etc.) enviará los mensajes
app.post('/chat-webhook', async (req, res) => {
    // Simulamos los datos que llegarían de la plataforma de chat
    const { email, firstName, message } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'El email es obligatorio para buscar en HubSpot' });
    }

    try {
        let contactId;
        let botResponse = '';

        // 1. Buscar si el contacto ya existe en HubSpot por su email
        const searchRequest = {
            filterGroups: [{
                filters: [{ propertyName: 'email', operator: 'EQ', value: email }]
            }],
            properties: ['email', 'firstname', 'lifecyclestage']
        };

        const searchResult = await hubspotClient.crm.contacts.searchApi.doSearch(searchRequest);

        if (searchResult.total > 0) {
            // El contacto existe
            const contact = searchResult.results[0];
            contactId = contact.id;
            botResponse = `Hola de nuevo ${contact.properties.firstname || ''}. He visto tu mensaje: "${message}". Lo anotaré en tu ficha.`;
            
            console.log(`Contacto existente encontrado. ID: ${contactId}`);
        } else {
            // 2. El contacto NO existe, lo creamos
            const newContact = await hubspotClient.crm.contacts.basicApi.create({
                properties: {
                    email: email,
                    firstname: firstName || 'Usuario',
                    lifecyclestage: 'lead' // Lo catalogamos como lead (prospecto)
                }
            });
            contactId = newContact.id;
            botResponse = `¡Hola ${firstName}! Es tu primera vez aquí. He registrado tu perfil y tu mensaje: "${message}".`;
            
            console.log(`Nuevo contacto creado. ID: ${contactId}`);
        }

        // 3. (Opcional) Aquí podrías usar la API de Engagements para guardar el 'message'
        // como una nota o un correo dentro de la ficha de este contactId en HubSpot.

        // Responder al canal de chat para que se lo muestre al usuario
        res.status(200).json({ 
            reply: botResponse,
            hubspotContactId: contactId
        });

    } catch (error) {
        console.error('Error al conectar con HubSpot:', error.message);
        res.status(500).json({ reply: 'Hubo un error al procesar tu solicitud con el CRM.' });
    }
});

// Levantar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de Chatbot corriendo en el puerto ${PORT}`);
});