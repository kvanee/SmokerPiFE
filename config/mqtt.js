// Publishes smoker temperatures and alert state to MQTT for Home Assistant.
//
// Home Assistant auto-discovers the entities (a "SmokerPi" device with smoker
// and meat temperature sensors, a blower sensor, a temperature-alert binary
// sensor, and a meat-ready binary sensor) from the retained discovery configs
// below. An HA automation watching the alert sensor handles the actual push
// notification (incl. repeat-until-acknowledged) — see docs/home-assistant-mqtt.md.
//
// Configuration (all via env; if MQTT_URL is unset the integration is skipped):
//   MQTT_URL              e.g. mqtt://user:pass@10.0.10.3:1883
//   MQTT_TOPIC_PREFIX     base topic for state/availability (default "smokerpi")
//   MQTT_DISCOVERY_PREFIX HA discovery prefix (default "homeassistant")

const mqtt = require('mqtt');
const monitor = require('../bbqMonitor');

module.exports = function initMqtt() {
    const url = process.env.MQTT_URL;
    if (!url) {
        console.log('MQTT not configured (set MQTT_URL); skipping Home Assistant integration.');
        return null;
    }

    const prefix = process.env.MQTT_TOPIC_PREFIX || 'smokerpi';
    const discoveryPrefix = process.env.MQTT_DISCOVERY_PREFIX || 'homeassistant';
    const stateTopic = prefix + '/state';
    const availabilityTopic = prefix + '/availability';

    const client = mqtt.connect(url, {
        // Last will: if the smoker drops off, HA marks the entities unavailable.
        will: { topic: availabilityTopic, payload: 'offline', retain: true, qos: 1 },
        reconnectPeriod: 5000
    });

    client.on('connect', () => {
        console.log('MQTT connected to ' + url.replace(/\/\/.*@/, '//***@'));
        client.publish(availabilityTopic, 'online', { retain: true, qos: 1 });
        publishDiscovery(client, discoveryPrefix, stateTopic, availabilityTopic);
    });
    client.on('error', (err) => console.log('MQTT error: ' + err.message));

    // Publish a state snapshot on every monitor tick.
    monitor.subscribe((data) => {
        if (!client.connected) return;
        const payload = JSON.stringify({
            bbq: Number(data.currBbqTemp),
            meat: Number(data.currMeatTemp),
            target: Number(data.targetTemp),
            blower: data.isBlowerOn ? 'ON' : 'OFF',
            alert: data.alertActive ? 'ON' : 'OFF',
            alert_type: data.alertType,
            alert_reason: data.alertReason,
            meat_ready: data.meatReady ? 'ON' : 'OFF',
            session: data.sessionName
        });
        client.publish(stateTopic, payload, { qos: 1 });
    });

    return client;
};

function publishDiscovery(client, discoveryPrefix, stateTopic, availabilityTopic) {
    const device = {
        identifiers: ['smokerpi'],
        name: 'SmokerPi',
        manufacturer: 'SmokerPi',
        model: 'BBQ Controller'
    };
    const base = {
        state_topic: stateTopic,
        availability_topic: availabilityTopic,
        device: device
    };
    const entities = [
        ['sensor/smokerpi/bbq', {
            name: 'Smoker Temperature', unique_id: 'smokerpi_bbq',
            device_class: 'temperature', unit_of_measurement: '°F',
            state_class: 'measurement', value_template: '{{ value_json.bbq }}'
        }],
        ['sensor/smokerpi/meat', {
            name: 'Meat Temperature', unique_id: 'smokerpi_meat',
            device_class: 'temperature', unit_of_measurement: '°F',
            state_class: 'measurement', value_template: '{{ value_json.meat }}'
        }],
        ['sensor/smokerpi/target', {
            name: 'Target Temperature', unique_id: 'smokerpi_target',
            device_class: 'temperature', unit_of_measurement: '°F',
            value_template: '{{ value_json.target }}'
        }],
        ['binary_sensor/smokerpi/blower', {
            name: 'Blower', unique_id: 'smokerpi_blower',
            device_class: 'running', payload_on: 'ON', payload_off: 'OFF',
            value_template: '{{ value_json.blower }}'
        }],
        ['binary_sensor/smokerpi/alert', {
            name: 'Temperature Alert', unique_id: 'smokerpi_alert',
            device_class: 'problem', payload_on: 'ON', payload_off: 'OFF',
            value_template: '{{ value_json.alert }}',
            json_attributes_topic: stateTopic
        }],
        ['binary_sensor/smokerpi/meat_ready', {
            name: 'Meat Ready', unique_id: 'smokerpi_meat_ready',
            payload_on: 'ON', payload_off: 'OFF',
            value_template: '{{ value_json.meat_ready }}'
        }]
    ];
    for (const [path, cfg] of entities) {
        client.publish(
            discoveryPrefix + '/' + path + '/config',
            JSON.stringify(Object.assign({}, cfg, base)),
            { retain: true, qos: 1 }
        );
    }
}
