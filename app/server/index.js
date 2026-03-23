const express = require('express');
const cors = require('cors');
const path = require('path');
const chatRouter = require('./routes/chat');
const stateRouter = require('./routes/state');
const thoughtsRouter = require('./routes/thoughts');
const resetRouter = require('./routes/reset');
const innerLoop = require('./entity/innerLoop');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

app.use('/api/chat', chatRouter);
app.use('/api/state', stateRouter);
app.use('/api/thoughts', thoughtsRouter);
app.use('/api/reset', resetRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  innerLoop.start();
});
