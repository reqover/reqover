import {NextFunction, Request, Response} from 'express';
import swaggerParser from '@apidevtools/swagger-parser';
import UrlPattern from 'url-pattern';
import merge from 'deepmerge';
import {spec} from '../app';
import {SWAGGER_BASE_PATH, SWAGGER_SPEC_URL} from '../config/constants';

class SwaggerController {
    public specs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            res.send(spec);
        } catch (error) {
            next(error);
        }
    };

    public reset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        spec.length = 0;
        res.send({status: 'done'});
    };

    public info = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const apiList = await this.getSwaggerPaths(SWAGGER_SPEC_URL);
            res.send(apiList);
        } catch (error) {
            next(error);
        }
    };

    public report = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const reportData = await this.getCoverageReport(SWAGGER_SPEC_URL);
            res.render('index', {data: reportData});
        } catch (error) {
            next(error);
        }
    };

    public coverage = async (req: any, res: Response, next: NextFunction): Promise<void> => {
        try {
            res.send(await this.getCoverageReport(SWAGGER_SPEC_URL));
        } catch (error) {
            next(error);
        }
    };

    private getSwaggerPaths = async (swaggerSpec: any) => {
        const swaggerInfo: any = await swaggerParser.validate(swaggerSpec);
        const {basePath, paths} = swaggerInfo;
        const apiPaths = Object.entries(paths);

        const apiList = apiPaths.map(([apiPath, value]) => {
            let path = `${apiPath}`;
            if (!basePath) {
                path = `${SWAGGER_BASE_PATH}${apiPath}`;
            }

            const methods = Object.entries(value).map(([methodName, data]) => {
                const {responses, parameters} = data;

                return {
                    path: path,
                    name: methodName.toUpperCase(),
                    responses: Object.keys(responses),
                    parameters: parameters ? parameters : [],
                };
            });

            return {path: path, methods};
        });

        return apiList;
    };

    private getCoverageReport = async (swaggerSpec: any) => {
        const apiList = await this.getSwaggerPaths(swaggerSpec);
        const swaggerUrls = apiList.map((u: any) => u.path);

        const apiCovList: any = apiList.map((apiItem) => {
            const coveredApis = this.findCoveredApis(apiItem, swaggerUrls);

            const coveredMethods = apiItem.methods.map((method) => {
                const {name, responses, parameters} = method;
                const coveredMethodNames: any = coveredApis.filter((c) => c.method == name);

                const coveredStatusCodes = [...new Set(coveredMethodNames.map((m) => m.response))];
                const missingStatusCodes = responses.filter((s) => !coveredStatusCodes.includes(s));

                const coveredParameters = [
                    ...new Set(
                        coveredMethodNames
                            .map((m) => {
                                return m.parameters.map((p) => p.name);
                            })
                            .flat(),
                    ),
                ];
                const missingParameters = parameters
                    .map(({name, required, type, ...p}) => {
                        return {name, required, in: p.in, type};
                    })
                    .map((mp) => mp.name)
                    .filter((m) => !coveredParameters.includes(m));

                const coverage = ((coveredStatusCodes.length / (coveredStatusCodes.length + missingStatusCodes.length)) * 100).toFixed();

                let status = 'danger';
                status = +coverage > 0 && +coverage < 100 ? 'warning' : 'success';

                let requestsCount = 0;
                let bodies = [];
                if (coveredMethodNames.length > 0) {
                    requestsCount = coveredApis.length;
                    bodies = coveredApis.map((ca) => ca.body);
                }

                return {
                    path: apiItem['path'],
                    requests: requestsCount,
                    method: name,
                    coverage,
                    status,
                    responses: {
                        missed: missingStatusCodes,
                        covered: coveredStatusCodes,
                    },
                    parameters: {
                        missed: missingParameters,
                        covered: coveredParameters,
                    },
                    bodies: bodies,
                    mergedBody: this.mergeBody(bodies)
                };
            });

            return coveredMethods;
        });

        return apiCovList.flat();
    };

    private regExMatchOfPath = (apiPath: string, rPath: string) => {
        return new UrlPattern(apiPath.replace(/\/{/g, '{/:'), {
            optionalSegmentStartChar: '{',
            optionalSegmentEndChar: '}',
        }).match(rPath);
    };

    private findCoveredApis = (apiItem: any, swaggerUrls: any) => {
        const apiPath = apiItem['path'];
        return spec
            .filter((path) => {
                const currentPath = path['path'];
                if (apiPath != currentPath && this.isSwaggerUrl(swaggerUrls, currentPath)) {
                    return false;
                }

                return this.regExMatchOfPath(apiPath, currentPath);
            })
            .map((api) => {
                console.log();
                const currentPath = api['path'];
                const match = this.regExMatchOfPath(apiPath, currentPath);
                if (match) {
                    api.parameters.push(
                        ...Object.keys(match).map((k) => {
                            return {name: k};
                        }),
                    );
                }

                return {
                    ...api,
                };
            });
    };

    private isSwaggerUrl(swaggerUrls, path): boolean {
        return swaggerUrls.includes(path);
    }

    private mergeBody(bodies: any[]) {
        const combineMerge = (target, source, options) => {
            const destination = target.slice();

            source.forEach((item, index) => {
                if (typeof destination[index] === 'undefined') {
                    destination[index] = options.cloneUnlessOtherwiseSpecified(item, options);
                } else if (options.isMergeableObject(item)) {
                    destination[index] = merge(target[index], item, options);
                } else if (target.indexOf(item) === -1) {
                    destination.push(item);
                }
            });
            return destination;
        };

        return merge.all(bodies, {arrayMerge: combineMerge});
    }
}

export default SwaggerController;
