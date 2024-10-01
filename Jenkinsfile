pipeline {
   agent any
   environment {
     SERVICE_NAME = "ms-tpm"
    DOCKER_REGISTRY = "localhost:3200"
    NAMESPACE = "platform-app"
    BUILD_ARG_PROXY= " --build-arg HTTPS_PROXY=http://10.32.254.2:3128 --build-arg HTTP_PROXY=http://10.32.254.2:3128 "
   }
 
   stages {
     stage('Preparation') {
        steps {
           cleanWs()
           git branch: 'main', credentialsId: 'f184af08-bec6-4143-b887-27af53873d6d', url: "https://gitlab.com/tpm2191622/backend.git"
        }
   }
 
  stage('Build Image') {
     steps {
      sh 'docker build --build-arg DOCKER_ENV=dev ${BUILD_ARG_PROXY} . -t localhost:32000/${SERVICE_NAME}'
     }
  }
 
  stage('Artifact') {
     steps {
       sh 'docker push localhost:32000/${SERVICE_NAME}'
     }
  }
 
  //for first deployment cmd : kubectl apply -f deploy.yaml -n  ${NAMESPACE}
  stage('Deploy to Cluster') {
    steps {
      sh 'microk8s kubectl rollout restart deployment ${SERVICE_NAME} -n ${NAMESPACE}'
     //sh 'envsubst < ${WORKSPACE}/deploy.yaml | microk8s kubectl apply -f - -n ${NAMESPACE}'
    }
  }
 
  stage('Cleanup') {
      steps{
        //sh "docker rmi localhost:32000/${SERVICE_NAME}"
      sh "docker container prune -f"
      sh "docker rmi `docker images --filter dangling=true -q`"
      }
 }
}
}
 