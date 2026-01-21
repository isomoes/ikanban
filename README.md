# iKanban

A Rust-based multi-agent task management system with a core server and multiple client support via HTTP/WebSocket.

## Architecture

```
+------------------+     +------------------+     +------------------+
|   TUI Client     |     |   Web Client     |     |  Other Clients   |
+--------+---------+     +--------+---------+     +--------+---------+
         |                        |                        |
         |         WebSocket      |         WebSocket      |
         +------------------------+------------------------+
                                  |
                    +-------------+-------------+
                    |      iKanban Core         |
                    |     (WebSocket API)       |
                    +-------------+-------------+
                                  |
                    +-------------+-------------+
                    |     SQLite Database       |
                    +---------------------------+
```

## License

MIT
