import {cleanEnv, port, str} from 'envalid';

const validateEnv = () => {
    cleanEnv(process.env, {
        NODE_ENV: str(),
        PORT: port(),
        API_SERVICE_URL: str(),
        SWAGGER_SPEC_URL: str(),
    });
};

export default validateEnv;
