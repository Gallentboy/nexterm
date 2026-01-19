use anyhow::Result;
use russh::keys::{load_openssh_certificate, load_secret_key, PrivateKeyWithHashAlg, PublicKey};
use russh::{client, Disconnect};
use std::path::Path;
use std::sync::Arc;
use tokio::net::ToSocketAddrs;

pub struct Client {}

// More SSH event handlers
// can be defined in this trait
// In this example, we're only using Channel, so these aren't needed.
impl client::Handler for Client {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &PublicKey,
    ) -> anyhow::Result<bool, Self::Error> {
        Ok(true)
    }
}

pub struct Session {
    pub session: client::Handle<Client>,
}

impl Session {
    pub(crate) async fn connect_by_key<P: AsRef<Path>, A: ToSocketAddrs>(
        key_path: P,
        user: impl Into<String>,
        openssh_cert_path: Option<P>,
        addrs: A,
        cfg: client::Config,
    ) -> Result<Self> {
        let key_pair = load_secret_key(key_path, None)?;

        // load ssh certificate
        let mut openssh_cert = None;
        if openssh_cert_path.is_some() {
            openssh_cert = Some(load_openssh_certificate(openssh_cert_path.unwrap())?);
        }

        let config = Arc::new(cfg);
        let sh = Client {};

        let mut session = client::connect(config, addrs, sh).await?;

        // use publickey authentication, with or without certificate
        if openssh_cert.is_none() {
            let auth_res = session
                .authenticate_publickey(
                    user,
                    PrivateKeyWithHashAlg::new(
                        Arc::new(key_pair),
                        session.best_supported_rsa_hash().await?.flatten(),
                    ),
                )
                .await?;

            if !auth_res.success() {
                anyhow::bail!("Authentication (with publickey) failed");
            }
        } else {
            let auth_res = session
                .authenticate_openssh_cert(user, Arc::new(key_pair), openssh_cert.unwrap())
                .await?;

            if !auth_res.success() {
                anyhow::bail!("Authentication (with publickey+cert) failed");
            }
        }

        Ok(Self { session })
    }

    pub async fn connect_by_password<A: ToSocketAddrs>(
        user: impl Into<String>,
        password: impl Into<String>,
        addrs: A,
        cfg: client::Config,
    ) -> Result<Self> {
        let config = Arc::new(cfg);
        let sh = Client {};
        let mut session = client::connect(config, addrs, sh).await?;
        let auth_result = session.authenticate_password(user, password).await?;
        if !auth_result.success() {
            anyhow::bail!("Authentication (with password) failed");
        }
        Ok(Self { session })
    }

    async fn close(&mut self) -> Result<()> {
        self.session
            .disconnect(Disconnect::ByApplication, "", "English")
            .await?;
        Ok(())
    }
}
