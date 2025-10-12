import express, { Application } from 'express';
import cors from 'cors';
import compilerRoutes from './router/compilerRoutes';

const app: Application = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/compiler', compilerRoutes);


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

export default app;