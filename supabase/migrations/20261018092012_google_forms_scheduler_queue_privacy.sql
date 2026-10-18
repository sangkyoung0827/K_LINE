begin;
-- pg_net defaults expose queue headers to PUBLIC. Restrict before storing any bearer token.
-- The fixed-origin dispatcher runs as its postgres owner; browser roles need no net access.
revoke all on net.http_request_queue, net._http_response from public, anon, authenticated;
revoke all on all functions in schema net from public, anon, authenticated;
commit;
