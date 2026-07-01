# Home Assistant alerts via MQTT

The smoker publishes live temperatures and alert state to MQTT. Home Assistant
auto-discovers the entities and an automation turns the temperature alert into a
push notification that **repeats until you acknowledge it**.

## 1. Configure the smoker (Dokku env)

```bash
dokku config:set smoker \
  MQTT_URL="mqtt://10.0.10.3:1883" \
  MQTT_USERNAME="smokerpi" \
  MQTT_PASSWORD="your-password"
# optional overrides:
#   MQTT_TOPIC_PREFIX=smokerpi      (state/availability base topic)
#   MQTT_DISCOVERY_PREFIX=homeassistant
```

Credentials: prefer `MQTT_USERNAME` / `MQTT_PASSWORD` env vars (they override any
creds in the URL and avoid URL-encoding pitfalls). You can still embed them as
`mqtt://user:pass@host:port`, but a password containing `@ : / #` must be
percent-encoded or it will mis-parse and the broker returns **"Connection
refused: Not authorized"**.

If `MQTT_URL` is unset the integration is silently skipped (nothing breaks).
Use a dedicated MQTT user limited (via broker ACL) to the `smokerpi/#` and
`homeassistant/#` topics. For the Home Assistant Mosquitto add-on, that user is
typically a Home Assistant login (or a `logins:` entry in the add-on config).

## 2. Entities created (no manual config needed)

Discovery creates a **SmokerPi** device with:

| Entity | Type |
| --- | --- |
| `sensor.smoker_temperature` | temperature (°F) |
| `sensor.meat_temperature` | temperature (°F) |
| `sensor.target_temperature` | temperature (°F) |
| `binary_sensor.blower` | running |
| `binary_sensor.temperature_alert` | problem (on = too hot/too cool) |
| `binary_sensor.meat_ready` | on when meat reaches its target |

`binary_sensor.temperature_alert` carries `alert_type` (`high`/`low`) and
`alert_reason` (human text) as attributes. The smoker only alerts during an
active cook and won't fire "too cool" while it's still warming up from cold.

## 3. Automation — repeat until acknowledged

Notify service is set to `notify.mobile_app_kells_s23u` (your S23 Ultra). Change it if you want alerts on a different device.

```yaml
alias: SmokerPi temperature alert (repeat until acknowledged)
mode: single
triggers:
  - trigger: state
    entity_id: binary_sensor.temperature_alert
    to: "on"
actions:
  - repeat:
      sequence:
        - action: notify.mobile_app_kells_s23u
          data:
            title: "🔥 Smoker alert"
            message: "{{ state_attr('binary_sensor.temperature_alert', 'alert_reason') }}"
            data:
              tag: smokerpi-alert            # replaces the prior notification
              priority: high
              ttl: 0
              actions:
                - action: SMOKERPI_ACK
                  title: Acknowledge
        - wait_for_trigger:
            - trigger: event
              event_type: mobile_app_notification_action
              event_data:
                action: SMOKERPI_ACK
            - trigger: state
              entity_id: binary_sensor.temperature_alert
              to: "off"
          timeout: "00:05:00"             # re-notify every 5 minutes
          continue_on_timeout: true
      until:
        - condition: template
          # stop when acknowledged OR the alert cleared; keep going on timeout
          value_template: "{{ wait.trigger is not none }}"
  - action: notify.mobile_app_kells_s23u   # dismiss the lingering notification
    data:
      message: clear_notification
      data:
        tag: smokerpi-alert
```

Optional "meat is ready" notification:

```yaml
alias: SmokerPi meat ready
triggers:
  - trigger: state
    entity_id: binary_sensor.meat_ready
    to: "on"
actions:
  - action: notify.mobile_app_kells_s23u
    data:
      title: "✅ Meat is ready"
      message: "Meat reached its target temperature."
```

## How acknowledgement works

The smoker keeps reporting the *true* alert state (on while out of range). The
"repeat until acknowledged" behavior lives in HA: the actionable notification
re-fires every 5 minutes until you tap **Acknowledge** or the temperature
returns to range. Acknowledging silences the nag but the `temperature_alert`
entity stays on until the smoker is actually back in range.
