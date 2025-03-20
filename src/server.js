import express from 'express';
import bodyParser from 'body-parser';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { fromIni } from "@aws-sdk/credential-providers";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { filterImageFromURL } from '../util/util.js';
import fs from "fs/promises";

import dotenv from 'dotenv';
dotenv.config();

// Initialize AWS Secrets Manager client
const secretsManagerClient = new SecretsManagerClient({
  region: "us-east-1",
  credentials: fromIni({ profile: "user-udacity" }),
});

const secret_name = "my-app/aws-credentials";

// Function to retrieve AWS credentials from environment variables
async function getAwsCredentials() {
  try {
    // Retrieve AWS credentials from environment variables
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'us-east-1'; // Default region if not set
    const bucketName = process.env.S3_BUCKET_NAME; // Retrieve the bucket name from environment variables

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials are not set in the environment variables');
    }

    return {
      accessKeyId,
      secretAccessKey,
      region,
      bucketName
    };
  } catch (error) {
    console.error('Error retrieving AWS credentials from environment variables:', error);
    throw error;
  }
}

// Call the function
getAwsCredentials().then(() => console.log("AWS credentials retrieved successfully"));

// Initialize AWS SDK with credentials from Secrets Manager
async function initializeAwsSdk() {
  const credentials = await getAwsCredentials();
  const s3Client = new S3Client({
    region: credentials.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });
  return { s3Client, bucketName: credentials.bucketName };
}

// Function to upload an image to S3
async function uploadImageToS3(s3Client, imageBuffer, bucketName) {
  const params = {
    Bucket: bucketName, // Use the bucket name from Secrets Manager
    Key: `filtered_${Date.now()}.jpg`, // Unique file name
    Body: imageBuffer,
    ContentType: 'image/jpeg'
  };

  try {
    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    return `https://${params.Bucket}.s3.amazonaws.com/${params.Key}`;
  } catch (error) {
    console.error('Error uploading image to S3:', error);
    throw new Error('Failed to upload image to S3');
  }
}

// Init the Express application
const app = express();

// Set the network port
const port = process.env.PORT || 8082;

// Use the body parser middleware for post requests
app.use(bodyParser.json());

// Start the Server
initializeAwsSdk()
  .then(({ s3Client, bucketName }) => {
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });

    // Endpoint to filter an image
    app.get('/filteredimage', async (req, res) => {
      const imageUrl = req.query.image_url;
    
      if (!imageUrl) {
        return res.status(400).send('image_url query parameter is required');
      }
    
      try {
        // 1. Filter the image and get the file path
        const filteredImagePath = await filterImageFromURL(imageUrl);
    
        // 2. Read the filtered image file into a buffer
        const imageBuffer = await fs.readFile(filteredImagePath);
    
        // 3. Upload the image buffer to S3
        const s3ImageUrl = await uploadImageToS3(s3Client, imageBuffer, bucketName);
    
        // 4. Delete the local file after upload
        await fs.unlink(filteredImagePath);
    
        // 5. Return the S3 image URL in the response
        res.send({ imageUrl: s3ImageUrl });
      } catch (error) {
        console.error('Error processing image:', error);
        res.status(422).send('Unable to process the image. Please check the image URL and try again.');
      }
    });
  })
  .catch((error) => {
    console.error('Failed to initialize AWS SDK:', error);
  });

// Root Endpoint (Moved outside `.then()`)
app.get("/", async (req, res) => {
  res.send("Try GET /filteredimage?image_url={{}}");
});
