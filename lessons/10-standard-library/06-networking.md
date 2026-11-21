# Networking

`serve![port handler]` starts an HTTP server. The handler gets `[method:.. url:.. headers:[..] body:..]` and returns `[status:.. headers:[..] body:..]`. It runs under Node only.

```bash
npm start examples/server.punk
```

`urlencode` and `urldecode` convert text for URLs, and `import!punk.http` has helpers for responses and forms.
