const path = require('path');
const webpack = require('webpack');

module.exports = {
    entry: './src/index.js',
    watch: true,
    output: {
        filename: 'all.js',
        path: path.resolve('./dist')
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules\//,
                use: [
                    //{
                    //    loader: 'ng-annotate-loader'
                    //},
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: ['env']
                        }
                    }
                ]
            },
            {
                test: /\.html$/,
                exclude: /node_modules\//,
                use: [
                    {
                        loader: 'html-loader'
                    }
                ]
            },
            {
                test: /\.(scss)$/,
                use: [{
                    loader: 'style-loader', // inject CSS to page
                }, {
                    loader: 'css-loader', // translates CSS into CommonJS modules
                }, {
                    loader: 'postcss-loader', // Run post css actions
                    options: {
                        plugins: function () { // post css plugins, can be exported to postcss.config.js
                            return [
                                require('precss'),
                                require('autoprefixer'),
                                //require('css-flip'),
                            ];
                        }
                    }
                }, {
                    loader: 'sass-loader' // compiles SASS to CSS
                }]
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }

        ]
    },
    plugins: [
        new webpack.ProvidePlugin({
            $: "jquery",
            jQuery: "jquery",
            Popper: 'popper.js',
        }),
        // new webpack.optimize.UglifyJsPlugin()
    ]
};


