# AUTO-GENERATED FILE. DO NOT EDIT.

| Method | Path | Summary | Request Body | 2xx Response |
| --- | --- | --- | --- | --- |
| POST | /alerts | Create alert | ref:alert- | ref:alert- |
| GET | /alerts/{trade_id} | List alerts for trade | no payload | array:alert |
| POST | /auth/oauth | Authenticate via OAuth | type:object | type:object |
| POST | /auth/register | Register user account | type:object | ref:user-- |
| GET | /health | Check service health (check) | no payload | OK-------- |
| POST | /images | Request image upload URL | type:object | type:object |
| GET | /patterns/{trade_id} | Get pattern result for trade | no payload | ref:pattern_result |
| POST | /trades | Create trade | ref:trade- | ref:trade- |
| GET | /trades/{trade_id} | Get trade bundle | no payload | type:object |
