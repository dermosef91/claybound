# Working in Claybound

## Every major update ends with a test link — unprompted

A feature, a redesign, a chapter or section change, a visual pass: anything a
person should look at in the running game is handed over with a **local,
testable link**, without being asked for one.

1. Serve the checkout or worktree that holds the change — `dist/` is the
   authored source and needs no build (see LOCAL-DEPLOYMENT.md):
   `nohup python3 -m http.server <port> --bind 127.0.0.1 --directory dist > /dev/null 2>&1 &`
   started detached so it outlives the session. The main checkout uses 5173;
   a worktree takes the first free port in 5174–5199 (check with
   `lsof -nP -iTCP:<port> -sTCP:LISTEN`) and keeps that port across its later
   updates, so a browser's saved progress stays with the branch it played.
2. Confirm it answers: `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:<port>/` → 200.
3. Put in the report: the URL, which branch and worktree it serves, and how to
   reach the change — The Soft Dream and the Clay Lab stay hidden until ß is
   typed with the chapter list open; a section deep in a chapter is quickest
   reached from a checkpoint or the editor's Test.

A link only lives as long as the files it serves: keep the worktree (or check
the branch out in the main checkout) for as long as the link is wanted.
