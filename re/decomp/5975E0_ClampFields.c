// 0x5975e0 ClampFields size=14E

int __thiscall sub_5975E0(int *this)
{
  int v1; // eax
  int v2; // eax
  int v3; // eax
  int v4; // eax
  int v5; // eax
  int v6; // eax
  int v7; // eax
  int v8; // eax
  int v9; // eax
  int v10; // eax
  int v11; // eax
  int v12; // eax
  int v13; // eax
  int v14; // eax
  int result; // eax

  v1 = *(this + 16);
  if ( v1 < 4 )
  {
    if ( v1 < 0 )
      *(this + 16) = 0;
  }
  else
  {
    *(this + 16) = 3;
  }
  v2 = *(this + 15);
  if ( v2 < 5 )
  {
    if ( v2 < 0 )
      *(this + 15) = 0;
  }
  else
  {
    *(this + 15) = 4;
  }
  v3 = *(this + 18);
  if ( v3 < 4 )
  {
    if ( v3 < 0 )
      *(this + 18) = 0;
  }
  else
  {
    *(this + 18) = 3;
  }
  v4 = *(this + 17);
  if ( v4 <= 100 )
  {
    if ( v4 < 0 )
      *(this + 17) = 0;
  }
  else
  {
    *(this + 17) = 100;
  }
  v5 = *(this + 19);
  if ( v5 <= 100 )
  {
    if ( v5 < 0 )
      *(this + 19) = 0;
  }
  else
  {
    *(this + 19) = 100;
  }
  v6 = *(this + 20);
  if ( v6 <= 8 )
  {
    if ( v6 < 2 )
      *(this + 20) = 2;
  }
  else
  {
    *(this + 20) = 8;
  }
  v7 = *(this + 21);
  if ( v7 <= 100 )
  {
    if ( v7 < 1 )
      *(this + 21) = 1;
  }
  else
  {
    *(this + 21) = 100;
  }
  v8 = *(this + 22);
  if ( v8 <= 100 )
  {
    if ( v8 < 0 )
      *(this + 22) = 0;
  }
  else
  {
    *(this + 22) = 100;
  }
  v9 = *(this + 23);
  if ( v9 <= 100 )
  {
    if ( v9 < 0 )
      *(this + 23) = 0;
  }
  else
  {
    *(this + 23) = 100;
  }
  v10 = *(this + 24);
  if ( v10 <= 100 )
  {
    if ( v10 < 0 )
      *(this + 24) = 0;
  }
  else
  {
    *(this + 24) = 100;
  }
  v11 = *(this + 25);
  if ( v11 < 4 )
  {
    if ( v11 < 0 )
      *(this + 25) = 0;
  }
  else
  {
    *(this + 25) = 3;
  }
  v12 = *(this + 26);
  if ( v12 < 4 )
  {
    if ( v12 < 0 )
      *(this + 26) = 0;
  }
  else
  {
    *(this + 26) = 3;
  }
  v13 = *(this + 27);
  if ( v13 <= 100 )
  {
    if ( v13 < 0 )
      *(this + 27) = 0;
  }
  else
  {
    *(this + 27) = 100;
  }
  v14 = *(this + 28);
  if ( v14 <= 100 )
  {
    if ( v14 < 0 )
      *(this + 28) = 0;
  }
  else
  {
    *(this + 28) = 100;
  }
  result = *(this + 29);
  if ( result <= 0xFFFF )
  {
    if ( result < 0 )
      *(this + 29) = 0;
  }
  else
  {
    *(this + 29) = 0xFFFF;
  }
  return result;
}
