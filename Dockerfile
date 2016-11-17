FROM scratch

COPY dist /

VOLUME /data

EXPOSE 9000
ENTRYPOINT ["/uifordocker"]
